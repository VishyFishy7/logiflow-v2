/**
 * Invoice repository — PRD §6.1 / §14.8.
 *
 * Actor-first. DTOs via src/mapping.ts. Lists via listEnvelope() from
 * @logiflow/contracts. Invoice numbering via the sequences table (§6.1).
 */
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  computeInvoiceTotals,
  formatDateIst,
  formatMoneyPlain,
  newId,
  toCsv,
  type CsvColumn,
} from "@logiflow/shared";
import {
  listEnvelope,
  type InvoiceCreateInput,
  type InvoiceDTO,
  type InvoiceStatus,
  type ListEnvelope,
} from "@logiflow/contracts";

/** Mirrors zInvoiceListQuery from contracts — zod is not a dependency of @logiflow/db. */
type InvoiceListQuery = {
  q?: string;
  status?: InvoiceStatus;
  from?: string | number;
  to?: string | number;
  sort?: string;
  dir?: "asc" | "desc";
  page: number;
  pageSize: number;
};
import { db, type Executor } from "../client.js";
import { ApiError } from "../errors.js";
import { recordAudit, diffChanges } from "../audit.js";
import type { Actor } from "../actor.js";
import {
  clients,
  invoiceLines,
  invoices,
  shipments,
  users,
} from "../schema/index.js";
import { rowToInvoice, internalIdEnvelope } from "../mapping.js";
import { mintInvoiceNumber } from "../services/sequences.js";
import {
  assertValidTransition,
  isOverdue as checkOverdue,
  shouldFlagOverdue,
} from "../services/invoices.js";

type InvoiceRow = typeof invoices.$inferSelect;
type InvoiceLineRow = typeof invoiceLines.$inferSelect;

// ── Sort ────────────────────────────────────────────────────────────────────

const SORT_COLUMNS = {
  createdAt: invoices.createdAt,
  updatedAt: invoices.updatedAt,
  issueDate: invoices.issueDate,
  dueDate: invoices.dueDate,
  totalPaise: invoices.totalPaise,
  number: invoices.number,
} as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function toMs(value: string | number | undefined, edge: "start" | "end"): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const iso = edge === "start" ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
    return Date.parse(iso);
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function buildInvoiceConditions(actor: Actor, query: InvoiceListQuery): SQL[] {
  const conditions: SQL[] = [eq(invoices.tenantId, actor.tenantId)];

  if (query.status) {
    conditions.push(eq(invoices.status, query.status));
  }

  if (query.from !== undefined) {
    const from = toMs(query.from, "start");
    if (from !== undefined) conditions.push(gte(invoices.issueDate, from));
  }
  if (query.to !== undefined) {
    const to = toMs(query.to, "end");
    if (to !== undefined) conditions.push(lte(invoices.issueDate, to));
  }

  if (query.q) {
    const needle = `%${query.q.toLowerCase()}%`;
    // Search invoice number or client name (via subquery)
    const search = or(
      like(sql`lower(${invoices.number})`, needle),
      like(
        sql`(SELECT lower(${clients.name}) FROM ${clients} WHERE ${clients.id} = ${invoices.clientId})`,
        needle,
      ),
    );
    if (search) conditions.push(search);
  }

  return conditions;
}

// ── listInvoices ────────────────────────────────────────────────────────────

export async function listInvoices(
  actor: Actor,
  query: InvoiceListQuery,
): Promise<ListEnvelope<InvoiceDTO>> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 25));
  const conditions = buildInvoiceConditions(actor, query);
  const where = and(...conditions);

  const sortKey = (query.sort as keyof typeof SORT_COLUMNS) ?? "createdAt";
  const sortColumn = SORT_COLUMNS[sortKey] ?? invoices.createdAt;
  const direction = query.dir === "asc" ? asc : desc;
  const offset = (page - 1) * pageSize;

  const [countRow] = await db
    .select({ value: count() })
    .from(invoices)
    .where(where);

  const total = countRow?.value ?? 0;

  const rows = await db
    .select()
    .from(invoices)
    .where(where)
    .orderBy(direction(sortColumn))
    .limit(pageSize)
    .offset(offset);

  // Batch-load client names
  const clientIds = [...new Set(rows.map((r) => r.clientId))];
  const clientRows = clientIds.length
    ? await db.select().from(clients).where(inArray(clients.id, clientIds))
    : [];
  const clientMap = new Map(clientRows.map((r) => [r.id, r]));

  // Batch-load line counts
  const invoiceIds = rows.map((r) => r.id);
  const lineCounts = invoiceIds.length
    ? await db
        .select({ invoiceId: invoiceLines.invoiceId, value: count() })
        .from(invoiceLines)
        .where(inArray(invoiceLines.invoiceId, invoiceIds))
        .groupBy(invoiceLines.invoiceId)
    : [];
  const lineCountMap = new Map(lineCounts.map((lc) => [lc.invoiceId, lc.value]));

  const now = Date.now();
  const data = rows.map((row) =>
    rowToInvoice(
      row,
      {
        clientName: clientMap.get(row.clientId)?.name ?? "Unknown",
        lineCount: lineCountMap.get(row.id) ?? 0,
      },
      now,
    ),
  );

  return listEnvelope(data, { page, pageSize, total });
}

// ── invoiceDetail ───────────────────────────────────────────────────────────

export async function invoiceDetail(actor: Actor, id: string): Promise<InvoiceDTO> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, actor.tenantId)))
    .limit(1);

  if (!row) {
    throw new ApiError("INVOICE_NOT_FOUND", "That invoice does not exist.");
  }

  // Client
  const [clientRow] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, row.clientId))
    .limit(1);

  // Lines
  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, id));

  // Linked shipments via invoice_lines.shipment_id (with masking per §8.3)
  const shipmentIds = [
    ...new Set(
      lines
        .map((l) => l.shipmentId)
        .filter((s): s is string => Boolean(s)),
    ),
  ];

  const shipmentRows = shipmentIds.length
    ? await db
        .select({ id: shipments.id, trackingId: shipments.trackingId })
        .from(shipments)
        .where(inArray(shipments.id, shipmentIds))
    : [];

  const shipmentMap = new Map(shipmentRows.map((s) => [s.id, s]));

  const linesDto: InvoiceDTO["lines"] = lines.map((l) => ({
    id: l.id,
    invoiceId: l.invoiceId,
    shipmentId: l.shipmentId ?? null,
    shipmentTrackingId: l.shipmentId
      ? internalIdEnvelope(shipmentMap.get(l.shipmentId)?.trackingId ?? null, actor.reveal).value
      : null,
    description: l.description,
    amountPaise: l.amountPaise,
    taxRateBp: l.taxRateBp,
  }));

  const shipmentsDto = shipmentIds.map((sid) => ({
    id: sid,
    trackingId: internalIdEnvelope(shipmentMap.get(sid)?.trackingId ?? null, actor.reveal).value,
  }));

  const now = Date.now();
  return rowToInvoice(
    row,
    {
      clientName: clientRow?.name ?? "Unknown",
      lineCount: lines.length,
      lines: linesDto,
      shipments: shipmentsDto,
    },
    now,
  );
}

// ── createInvoice ───────────────────────────────────────────────────────────

export async function createInvoice(
  actor: Actor,
  input: InvoiceCreateInput,
): Promise<InvoiceDTO> {
  // Validate client exists
  const [clientRow] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, input.clientId), eq(clients.tenantId, actor.tenantId)))
    .limit(1);
  if (!clientRow) {
    throw new ApiError("VALIDATION_FAILED", "Pick a client that belongs to this workspace.", {
      fieldErrors: { clientId: "Unknown client" },
    });
  }

  // Compute totals from lines (integer paise, no floats)
  const totals = computeInvoiceTotals(input.lines);
  const now = Date.now();
  const year = new Date(now).getFullYear();
  const invoiceId = newId();

  // Validate linked shipments exist (if any)
  const shipmentIds = input.lines
    .map((l) => l.shipmentId)
    .filter((s): s is string => Boolean(s));
  if (shipmentIds.length > 0) {
    const existingShipments = await db
      .select({ id: shipments.id })
      .from(shipments)
      .where(
        and(
          eq(shipments.tenantId, actor.tenantId),
          inArray(shipments.id, shipmentIds),
        ),
      );
    const existingSet = new Set(existingShipments.map((s) => s.id));
    for (const sid of shipmentIds) {
      if (!existingSet.has(sid)) {
        throw new ApiError("VALIDATION_FAILED", `Shipment ${sid} does not exist.`, {
          fieldErrors: { [`line shipmentId`]: "Unknown shipment" },
        });
      }
    }
  }

  // Normalize date inputs to epoch ms (input may carry ISO strings from zMsInput)
  const issueDateMs = typeof input.issueDate === "string" ? Date.parse(input.issueDate) : (input.issueDate ?? now);
  const dueDateMs = typeof input.dueDate === "string" ? Date.parse(input.dueDate) : input.dueDate;

  // Invoice number is minted inside the same transaction via the sequences table (§6.1).
  const invoiceValues = {
    id: invoiceId,
    tenantId: actor.tenantId,
    number: "",
    clientId: input.clientId,
    status: (input.status ?? "pending") as string,
    subtotalPaise: totals.subtotalPaise,
    taxPaise: totals.taxPaise,
    totalPaise: totals.totalPaise,
    currency: "INR",
    issueDate: issueDateMs,
    dueDate: dueDateMs,
    notes: input.notes ?? null,
    createdBy: actor.userId,
    createdAt: now,
    updatedAt: now,
  };

  db.transaction((tx) => {
    const number = mintInvoiceNumber(tx, actor.tenantId, year);
    invoiceValues.number = number;

    tx.insert(invoices)
      .values(invoiceValues)
      .run();

    // Insert lines + shipment linkage
    for (const line of input.lines) {
      const lineId = newId();
      tx.insert(invoiceLines)
        .values({
          id: lineId,
          tenantId: actor.tenantId,
          invoiceId,
          shipmentId: line.shipmentId ?? null,
          description: line.description,
          amountPaise: line.amountPaise,
          taxRateBp: line.taxRateBp,
          createdAt: now,
        })
        .run();
    }

    recordAudit(tx, actor, {
      action: "invoice.created",
      entityType: "invoice",
      entityId: invoiceId,
      entityLabel: `Invoice ${number}`,
      summary: `Created invoice ${number} for ${clientRow.name} — total ${formatMoneyPlain(totals.totalPaise)}`,
      changes: {
        number: { from: null, to: number },
        totalPaise: { from: null, to: totals.totalPaise },
      },
    });
  });

  return invoiceDetail(actor, invoiceId);
}

// ── updateInvoiceStatus ─────────────────────────────────────────────────────

export async function updateInvoiceStatus(
  actor: Actor,
  id: string,
  status: InvoiceStatus,
): Promise<InvoiceDTO> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, actor.tenantId)))
    .limit(1);

  if (!row) {
    throw new ApiError("INVOICE_NOT_FOUND", "That invoice does not exist.");
  }

  const currentStatus = row.status as InvoiceStatus;
  if (currentStatus === status) {
    return invoiceDetail(actor, id);
  }

  // Legal transition check (services/invoices.ts)
  assertValidTransition(currentStatus, status);

  const now = Date.now();
  const patch: Record<string, unknown> = {
    status,
    updatedAt: now,
  };

  // Set paidAt when status becomes paid (§14.8)
  if (status === "paid") {
    patch.paidAt = now;
  }

  db.transaction((tx) => {
    tx.update(invoices)
      .set(patch)
      .where(eq(invoices.id, id))
      .run();

    const changes = diffChanges(row as unknown as Record<string, unknown>, patch);

    recordAudit(tx, actor, {
      action: status === "overdue" ? "invoice.overdue_flagged" : "invoice.status_changed",
      entityType: "invoice",
      entityId: id,
      entityLabel: row.number,
      severity: status === "overdue" ? "warn" : "info",
      summary:
        status === "paid"
          ? `Invoice ${row.number} marked as paid`
          : status === "overdue"
            ? `Invoice ${row.number} flagged as overdue`
            : `Invoice ${row.number} status changed to ${status}`,
      changes,
    });
  });

  return invoiceDetail(actor, id);
}

// ── sendInvoice ─────────────────────────────────────────────────────────────

export async function sendInvoice(actor: Actor, id: string): Promise<void> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, actor.tenantId)))
    .limit(1);

  if (!row) {
    throw new ApiError("INVOICE_NOT_FOUND", "That invoice does not exist.");
  }

  const now = Date.now();
  db.transaction((tx) => {
    recordAudit(tx, actor, {
      action: "invoice.status_changed",
      entityType: "invoice",
      entityId: id,
      entityLabel: row.number,
      summary: `Invoice ${row.number} sent to ${row.clientId}`,
    });
  });
}

// ── recordInvoicePayment ────────────────────────────────────────────────────

export async function recordInvoicePayment(
  actor: Actor,
  id: string,
  input: { amountPaise?: number } = {},
): Promise<InvoiceDTO> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, actor.tenantId)))
    .limit(1);

  if (!row) {
    throw new ApiError("INVOICE_NOT_FOUND", "That invoice does not exist.");
  }

  const currentStatus = row.status as InvoiceStatus;
  if (currentStatus === "paid") {
    throw new ApiError("INVALID_STATUS_TRANSITION", "This invoice is already paid.");
  }

  const paidAmount = input.amountPaise ?? row.totalPaise;
  if (paidAmount < row.totalPaise) {
    // Partial payment not supported in v2 (PRD §18).
    throw new ApiError("VALIDATION_FAILED", "Partial payment is not supported. Pay the full amount.", {
      fieldErrors: { amountPaise: `Expected ${row.totalPaise} paise.` },
    });
  }

  const now = Date.now();
  db.transaction((tx) => {
    tx.update(invoices)
      .set({ status: "paid", paidAt: now, updatedAt: now })
      .where(eq(invoices.id, id))
      .run();

    recordAudit(tx, actor, {
      action: "invoice.status_changed",
      entityType: "invoice",
      entityId: id,
      entityLabel: row.number,
      summary: `Payment recorded for invoice ${row.number} — ${formatMoneyPlain(row.totalPaise)}`,
      changes: { status: { from: currentStatus, to: "paid" }, paidAt: { from: null, to: now } },
    });
  });

  return invoiceDetail(actor, id);
}

// ── overdueInvoiceList ──────────────────────────────────────────────────────

/**
 * Overdue invoices for the dashboard's "needs attention" block (§14.2).
 * Returns invoices that are pending and past due date.
 */
export async function overdueInvoiceList(actor: Actor): Promise<InvoiceDTO[]> {
  const now = Date.now();

  const rows = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, actor.tenantId),
        eq(invoices.status, "pending"),
        lte(invoices.dueDate, now),
      ),
    )
    .orderBy(asc(invoices.dueDate));

  // Batch-load client names
  const clientIds = [...new Set(rows.map((r) => r.clientId))];
  const clientRows = clientIds.length
    ? await db.select().from(clients).where(inArray(clients.id, clientIds))
    : [];
  const clientMap = new Map(clientRows.map((r) => [r.id, r]));

  return rows.map((row) =>
    rowToInvoice(row, { clientName: clientMap.get(row.clientId)?.name ?? "Unknown" }, now),
  );
}

// ── Invoice CSV export ──────────────────────────────────────────────────────

export const INVOICE_CSV_COLUMNS: CsvColumn<InvoiceDTO>[] = [
  { id: "number", header: "Invoice #", value: (r) => r.number },
  { id: "client", header: "Client", value: (r) => r.client.name },
  { id: "status", header: "Status", value: (r) => r.status },
  { id: "issueDate", header: "Issue date", value: (r) => formatDateIst(r.issueDate) },
  { id: "dueDate", header: "Due date", value: (r) => formatDateIst(r.dueDate) },
  { id: "subtotalPaise", header: "Subtotal", value: (r) => formatMoneyPlain(r.subtotalPaise) },
  { id: "taxPaise", header: "Tax", value: (r) => formatMoneyPlain(r.taxPaise) },
  { id: "totalPaise", header: "Total", value: (r) => formatMoneyPlain(r.totalPaise) },
  { id: "paidAt", header: "Paid at", value: (r) => (r.paidAt ? formatDateIst(r.paidAt) : "") },
  { id: "lineCount", header: "Lines", value: (r) => r.lineCount ?? 0 },
];

export async function invoicesCsv(
  actor: Actor,
  query: InvoiceListQuery,
): Promise<string> {
  const firstPage = await listInvoices(actor, { ...query, page: 1, pageSize: 200 });
  const rows: InvoiceDTO[] = [...firstPage.data];
  const maxPages = Math.min(firstPage.totalPages, 25);
  for (let page = 2; page <= maxPages; page++) {
    const next = await listInvoices(actor, { ...query, page, pageSize: 200 });
    rows.push(...next.data);
  }
  return toCsv(rows, INVOICE_CSV_COLUMNS);
}
