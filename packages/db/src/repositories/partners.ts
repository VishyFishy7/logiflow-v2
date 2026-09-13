/**
 * Clients and carriers — the partners layer (PRD §6.1 / §14.11).
 *
 * Schema columns come from packages/db-schema.md / schema/partners.ts:
 *   clients: id, tenantId, name, contactName, email, phone, gstin,
 *            addressLine1, addressLine2, city, state, pincode,
 *            creditTermsDays, active (boolean), createdBy, createdAt, updatedAt
 *   carriers: id, tenantId, code, name, adapter, trackingUrlTemplate,
 *             webhookSecretRef, webhookSecret, supportsWebhook (boolean),
 *             active (boolean), priority, createdAt, updatedAt
 */
import {
  and,
  asc,
  count,
  desc,
  eq,
  isNull,
  like,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  formatMoneyPlain,
  newId,
  toCsv,
  type CsvColumn,
} from "@logiflow/shared";
import {
  listEnvelope,
  type Carrier,
  type ClientDTO,
  type ListEnvelope,
} from "@logiflow/contracts";
import { db } from "../client";
import { ApiError } from "../errors";
import { recordAudit, diffChanges } from "../audit";
import type { Actor } from "../actor";
import {
  carriers,
  clients,
  invoices,
  shipments,
} from "../schema/index";
import { rowToCarrier, rowToClient } from "../mapping";
import { validateClientFields, validateCarrierFields } from "../services/partners";

/* ================================================================ clients === */

export function listClients(
  actor: Actor,
  query: {
    q?: string;
    page?: number;
    pageSize?: number;
    sort?: string;
    dir?: "asc" | "desc";
    active?: boolean;
  } = {},
): ListEnvelope<ClientDTO> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const conditions: SQL[] = [eq(clients.tenantId, actor.tenantId)];

  // Active filter (boolean column, not a string status)
  if (query.active !== undefined) {
    conditions.push(eq(clients.active, query.active));
  }

  if (query.q) {
    const needle = `%${query.q.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${clients.name})`, needle),
        like(sql`lower(${clients.email})`, needle),
        like(sql`lower(${clients.phone})`, needle),
        like(sql`lower(${clients.city})`, needle),
        like(sql`lower(${clients.gstin})`, needle),
      )!,
    );
  }

  const where = and(...conditions)!;

  // Sort column resolution — §14.11 aggregates are SQL sub-selects
  const sortColumn =
    query.sort === "outstanding"
      ? sql`outstanding_paise`
      : query.sort === "shipments"
        ? sql`shipment_count`
        : clients.name;
  const dir = query.dir === "desc" ? desc : asc;

  const rows = db
    .select({
      client: clients,
      shipmentCount: sql<number>`(
        SELECT count(*) FROM ${shipments}
        WHERE ${shipments.clientId} = ${clients.id}
          AND ${shipments.deletedAt} IS NULL
      )`,
      outstandingPaise: sql<number>`(
        SELECT COALESCE(SUM(${invoices.totalPaise}), 0) FROM ${invoices}
        WHERE ${invoices.clientId} = ${clients.id}
          AND ${invoices.status} <> 'paid'
      )`,
    })
    .from(clients)
    .where(where)
    .orderBy(dir(sortColumn))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  const [totalRow] = db
    .select({ value: count() })
    .from(clients)
    .where(where)
    .all();

  const data = rows.map((row) =>
    rowToClient(row.client, {
      shipmentCount: row.shipmentCount,
      outstandingPaise: row.outstandingPaise,
    }),
  );

  return listEnvelope(data, { page, pageSize, total: totalRow?.value ?? 0 });
}

function getClientRow(actor: Actor, id: string) {
  const [row] = db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.tenantId, actor.tenantId)))
    .limit(1)
    .all();
  if (!row) throw new ApiError("CLIENT_NOT_FOUND", "Client not found.");
  return row;
}

export function clientDetail(
  actor: Actor,
  id: string,
): {
  client: ClientDTO;
  stats: {
    shipmentCount: number;
    openShipmentCount: number;
    deliveredShipmentCount: number;
    delayedShipmentCount: number;
    revenuePaise: number;
    outstandingPaise: number;
  };
  recentShipmentIds: string[];
  recentInvoiceIds: string[];
} {
  const row = getClientRow(actor, id);

  const [shipmentStats] = db
    .select({
      shipmentCount: sql<number>`count(*)`,
      openShipmentCount: sql<number>`COALESCE(SUM(CASE WHEN ${shipments.status} <> 'delivered' THEN 1 ELSE 0 END), 0)`,
      deliveredShipmentCount: sql<number>`COALESCE(SUM(CASE WHEN ${shipments.status} = 'delivered' THEN 1 ELSE 0 END), 0)`,
      delayedShipmentCount: sql<number>`COALESCE(SUM(CASE WHEN ${shipments.status} = 'delayed' THEN 1 ELSE 0 END), 0)`,
    })
    .from(shipments)
    .where(and(eq(shipments.clientId, id), isNull(shipments.deletedAt)))
    .all();

  const [invoiceStats] = db
    .select({
      revenuePaise: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} <> 'cancelled' THEN ${invoices.totalPaise} ELSE 0 END), 0)`,
      outstandingPaise: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} NOT IN ('paid','cancelled') THEN ${invoices.totalPaise} ELSE 0 END), 0)`,
      activeInvoiceCount: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} NOT IN ('paid','cancelled') THEN 1 ELSE 0 END), 0)`,
    })
    .from(invoices)
    .where(eq(invoices.clientId, id))
    .all();

  const recent = db
    .select({ id: shipments.id })
    .from(shipments)
    .where(and(eq(shipments.clientId, id), isNull(shipments.deletedAt)))
    .orderBy(desc(shipments.createdAt))
    .limit(5)
    .all();

  const recentInvoices = db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.clientId, id))
    .orderBy(desc(invoices.issueDate))
    .limit(5)
    .all();

  return {
    client: rowToClient(row, {
      shipmentCount: shipmentStats?.shipmentCount ?? 0,
      outstandingPaise: invoiceStats?.outstandingPaise ?? 0,
    }),
    stats: {
      shipmentCount: shipmentStats?.shipmentCount ?? 0,
      openShipmentCount: shipmentStats?.openShipmentCount ?? 0,
      deliveredShipmentCount: shipmentStats?.deliveredShipmentCount ?? 0,
      delayedShipmentCount: shipmentStats?.delayedShipmentCount ?? 0,
      revenuePaise: invoiceStats?.revenuePaise ?? 0,
      outstandingPaise: invoiceStats?.outstandingPaise ?? 0,
    },
    recentShipmentIds: recent.map((r) => r.id),
    recentInvoiceIds: recentInvoices.map((r) => r.id),
  };
}

export function createClient(
  actor: Actor,
  input: {
    name: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    gstin?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    creditTermsDays?: number | null;
  },
): ClientDTO {
  // Service-level validation beyond zod
  validateClientFields({
    gstin: input.gstin,
    pincode: input.pincode,
    creditTermsDays: input.creditTermsDays,
  });

  // Duplicate check: unique on (tenantId, name) — case-insensitive
  const duplicate = db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.tenantId, actor.tenantId),
        sql`lower(${clients.name}) = ${input.name.toLowerCase()}`,
      ),
    )
    .all();
  if (duplicate.length > 0) {
    throw new ApiError("VALIDATION_FAILED", "That client already exists.", {
      fieldErrors: { name: "A client with this name already exists." },
    });
  }

  const now = Date.now();
  const row = {
    id: newId(),
    tenantId: actor.tenantId,
    name: input.name,
    contactName: input.contactName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    gstin: input.gstin ?? null,
    addressLine1: input.addressLine1 ?? null,
    addressLine2: input.addressLine2 ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    pincode: input.pincode ?? null,
    creditTermsDays: input.creditTermsDays ?? null,
    active: true as const,
    createdBy: actor.userId,
    createdAt: now,
    updatedAt: now,
  };

  db.transaction((tx) => {
    tx.insert(clients).values(row).run();
    recordAudit(tx, actor, {
      action: "client.created",
      entityType: "client",
      entityId: row.id,
      entityLabel: row.name,
      severity: "info",
      summary: `Client ${row.name} created`,
    });
  });

  return rowToClient(row, { shipmentCount: 0, outstandingPaise: 0 });
}

export function updateClient(
  actor: Actor,
  id: string,
  input: Record<string, unknown>,
): ClientDTO {
  const existing = getClientRow(actor, id);

  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) patch[key] = value;
  }

  // Service-level validation on the patch
  validateClientFields({
    gstin: (patch.gstin as string | null | undefined) ?? existing.gstin,
    pincode: (patch.pincode as string | null | undefined) ?? existing.pincode,
    creditTermsDays:
      (patch.creditTermsDays as number | null | undefined) ?? existing.creditTermsDays,
  });

  const changes = diffChanges(existing as unknown as Record<string, unknown>, patch);
  if (!changes) {
    return rowToClient(existing, { shipmentCount: 0, outstandingPaise: 0 });
  }

  db.transaction((tx) => {
    tx.update(clients).set(patch).where(eq(clients.id, id)).run();
    recordAudit(tx, actor, {
      action: "client.updated",
      entityType: "client",
      entityId: id,
      entityLabel: existing.name,
      severity: "info",
      summary: `Client ${existing.name} updated (${Object.keys(changes).join(", ")})`,
      changes,
    });
  });

  return rowToClient({ ...existing, ...patch } as typeof existing, {
    shipmentCount: 0,
    outstandingPaise: 0,
  });
}

/** Archive a client (set active = false). Uses "client.updated" audit action. */
export function archiveClient(actor: Actor, id: string): ClientDTO {
  const existing = getClientRow(actor, id);

  db.transaction((tx) => {
    tx.update(clients)
      .set({ active: false, updatedAt: Date.now() })
      .where(eq(clients.id, id))
      .run();
    recordAudit(tx, actor, {
      action: "client.updated",
      entityType: "client",
      entityId: id,
      entityLabel: existing.name,
      severity: "info",
      summary: `Client ${existing.name} archived`,
      changes: { active: { from: true, to: false } },
    });
  });

  return rowToClient({ ...existing, active: false, updatedAt: Date.now() } as typeof existing, {
    shipmentCount: 0,
    outstandingPaise: 0,
  });
}

/* ================================================================ carriers === */

export function listCarriers(
  actor: Actor,
  query: { q?: string; active?: boolean; page?: number; pageSize?: number } = {},
): ListEnvelope<Carrier> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const conditions: SQL[] = [eq(carriers.tenantId, actor.tenantId)];

  if (query.active !== undefined) {
    conditions.push(eq(carriers.active, query.active));
  }
  if (query.q) {
    const needle = `%${query.q.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${carriers.name})`, needle),
        like(sql`lower(${carriers.code})`, needle),
      )!,
    );
  }

  const where = and(...conditions)!;

  const rows = db
    .select({
      carrier: carriers,
      openShipments: sql<number>`(
        SELECT count(*) FROM ${shipments}
        WHERE ${shipments.carrierId} = ${carriers.id}
          AND ${shipments.deletedAt} IS NULL
          AND ${shipments.status} <> 'delivered'
      )`,
    })
    .from(carriers)
    .where(where)
    .orderBy(asc(carriers.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  const [totalRow] = db
    .select({ value: count() })
    .from(carriers)
    .where(where)
    .all();

  const data = rows.map((row) => rowToCarrier(row.carrier, row.openShipments));

  return listEnvelope(data, { page, pageSize, total: totalRow?.value ?? 0 });
}

function getCarrierRow(actor: Actor, id: string) {
  const [row] = db
    .select()
    .from(carriers)
    .where(and(eq(carriers.id, id), eq(carriers.tenantId, actor.tenantId)))
    .limit(1)
    .all();
  if (!row) throw new ApiError("CARRIER_NOT_FOUND", "Carrier not found.");
  return row;
}

export function carrierDetail(
  actor: Actor,
  id: string,
): { carrier: Carrier; openShipments: number } {
  const row = getCarrierRow(actor, id);

  const [stats] = db
    .select({
      openShipments: sql<number>`(
        SELECT count(*) FROM ${shipments}
        WHERE ${shipments.carrierId} = ${id}
          AND ${shipments.deletedAt} IS NULL
          AND ${shipments.status} <> 'delivered'
      )`,
    })
    .from(carriers)
    .where(eq(carriers.id, id))
    .all();

  return {
    carrier: rowToCarrier(row, stats?.openShipments ?? 0),
    openShipments: stats?.openShipments ?? 0,
  };
}

export function createCarrier(
  actor: Actor,
  input: {
    code: string;
    name: string;
    adapter?: string;
    trackingUrlTemplate?: string | null;
    supportsWebhook?: boolean;
    active?: boolean;
    priority?: number;
  },
): Carrier {
  validateCarrierFields({ code: input.code, name: input.name });

  // Duplicate check: unique on (tenantId, code)
  const duplicate = db
    .select({ id: carriers.id })
    .from(carriers)
    .where(
      and(
        eq(carriers.tenantId, actor.tenantId),
        eq(carriers.code, input.code.toUpperCase()),
      ),
    )
    .all();
  if (duplicate.length > 0) {
    throw new ApiError("VALIDATION_FAILED", "A carrier with this code already exists.", {
      fieldErrors: { code: "A carrier with this code already exists." },
    });
  }

  const now = Date.now();
  const row = {
    id: newId(),
    tenantId: actor.tenantId,
    code: input.code.toUpperCase(),
    name: input.name,
    adapter: input.adapter ?? "mock",
    trackingUrlTemplate: input.trackingUrlTemplate ?? null,
    webhookSecretRef: null,
    webhookSecret: null,
    supportsWebhook: input.supportsWebhook ?? false,
    active: input.active ?? true,
    priority: input.priority ?? 50,
    createdAt: now,
    updatedAt: now,
  };

  db.transaction((tx) => {
    tx.insert(carriers).values(row).run();
    recordAudit(tx, actor, {
      action: "carrier.created",
      entityType: "carrier",
      entityId: row.id,
      entityLabel: row.name,
      severity: "info",
      summary: `Carrier ${row.name} connected`,
    });
  });

  return rowToCarrier(row, 0);
}

export function updateCarrier(
  actor: Actor,
  id: string,
  input: Record<string, unknown>,
): Carrier {
  const existing = getCarrierRow(actor, id);

  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) patch[key] = value;
  }

  validateCarrierFields({
    code: (patch.code as string | undefined) ?? existing.code,
    name: (patch.name as string | undefined) ?? existing.name,
  });

  const changes = diffChanges(existing as unknown as Record<string, unknown>, patch);

  db.transaction((tx) => {
    if (changes) {
      tx.update(carriers).set(patch).where(eq(carriers.id, id)).run();
    }
    recordAudit(tx, actor, {
      action: "carrier.updated",
      entityType: "carrier",
      entityId: id,
      entityLabel: existing.name,
      severity: "info",
      summary: `Carrier ${existing.name} updated`,
      changes,
    });
  });

  return rowToCarrier({ ...existing, ...patch } as typeof existing, 0);
}

/* ================================================================ CSV === */

export function clientsCsv(
  actor: Actor,
  query: { q?: string; active?: boolean } = {},
): string {
  const page = listClients(actor, { ...query, page: 1, pageSize: 10_000 });
  const columns: CsvColumn<ClientDTO>[] = [
    { id: "name", header: "Name", value: (r) => r.name },
    { id: "contactName", header: "Contact", value: (r) => r.contactName ?? "" },
    { id: "email", header: "Email", value: (r) => r.email ?? "" },
    { id: "phone", header: "Phone", value: (r) => r.phone ?? "" },
    { id: "city", header: "City", value: (r) => r.city ?? "" },
    { id: "gstin", header: "GSTIN", value: (r) => r.gstin ?? "" },
    { id: "active", header: "Active", value: (r) => (r.active ? "Yes" : "No") },
    { id: "shipmentCount", header: "Shipments", value: (r) => String(r.shipmentCount ?? 0) },
    {
      id: "outstandingPaise",
      header: "Outstanding",
      value: (r) => formatMoneyPlain(r.outstandingPaise ?? 0),
    },
  ];
  return toCsv(page.data, columns);
}

export function carriersCsv(
  actor: Actor,
  query: { q?: string; active?: boolean } = {},
): string {
  const page = listCarriers(actor, { ...query, page: 1, pageSize: 10_000 });
  const columns: CsvColumn<Carrier>[] = [
    { id: "name", header: "Name", value: (r) => r.name },
    { id: "code", header: "Code", value: (r) => r.code },
    { id: "adapter", header: "Adapter", value: (r) => r.adapter },
    { id: "active", header: "Active", value: (r) => (r.active ? "Yes" : "No") },
    { id: "supportsWebhook", header: "Webhook", value: (r) => (r.supportsWebhook ? "Yes" : "No") },
    { id: "priority", header: "Priority", value: (r) => String(r.priority) },
    {
      id: "openShipments",
      header: "Open shipments",
      value: (r) => String(r.openShipments ?? 0),
    },
  ];
  return toCsv(page.data, columns);
}

/** Helper: format outstanding paise for display. */
export function outstandingLabel(paise: number): string {
  return formatMoneyPlain(paise);
}
