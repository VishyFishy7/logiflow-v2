/**
 * Shipments repository — the only place SQL lives for the shipment domain.
 *
 * Every function takes `actor: Actor` first and returns contract DTOs built
 * via the mapping helpers in `src/mapping.ts`. Checkpoints live here because
 * they are always queried in the context of a shipment; a separate file would
 * add indirection without simplifying anything.
 */
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  like,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  addDays,
  formatDateTimeSql,
  formatDateIst,
  formatMoneyPlain,
  generateTrackingId,
  isPlausibleCarrierTrackingId,
  newId,
  toCsv,
  type CsvColumn,
} from "@logiflow/shared";
import {
  SHIPMENT_STATUS_LABELS,
  SERVICE_LEVEL_TRANSIT_DAYS,
  listEnvelope,
  type ListEnvelope,
  type ShipmentDetailDTO,
  type ShipmentDTO,
  type ShipmentListQuery,
  type ShipmentStatus,
  type SyncState,
  type CheckpointDTO,
} from "@logiflow/contracts";
import { db, type Executor } from "../client";
import { ApiError } from "../errors";
import { recordAudit, diffChanges } from "../audit";
import {
  andAll,
  shipmentScopeCondition,
  visibilityCondition,
  type Actor,
} from "../actor";
import {
  carriers,
  checkpoints,
  clients,
  invoiceLines,
  invoices,
  shipments,
  users,
  attachments,
} from "../schema/index";
import { rowToCheckpoint, rowToShipment } from "../mapping";
import {
  assertTransition,
  checkpointLabelForStatus,
  checkpointLocationForStatus,
} from "../services/shipments";

// ── Local types (bulk inputs not exported from contracts) ──────────────────

interface ShipmentBulkAssignInput {
  ids: string[];
  assignedTo: string | null;
}

interface ShipmentBulkStatusInput {
  ids: string[];
  status: string;
  delayReason?: string;
  location?: string;
  note?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

type ShipmentRow = typeof shipments.$inferSelect;

const SORT_COLUMNS = {
  createdAt: shipments.createdAt,
  updatedAt: shipments.updatedAt,
  expectedDelivery: shipments.expectedDelivery,
  status: shipments.status,
  trackingId: shipments.trackingId,
} as const;

/** Statuses that count as "the shipment is still moving". */
export const OPEN_STATUSES: ShipmentStatus[] = [
  "pickup",
  "warehouse",
  "in_transit",
  "delayed",
];

export interface ShipmentFilterValues extends ShipmentListQuery {}

function baseConditions(actor: Actor, query: ShipmentFilterValues): SQL[] {
  const conditions: SQL[] = [
    eq(shipments.tenantId, actor.tenantId),
    isNull(shipments.deletedAt),
  ];

  const scope = visibilityCondition(actor);
  if (scope) conditions.push(scope);

  if (query.q) {
    const needle = `%${query.q.toLowerCase()}%`;
    const search = or(
      like(sql`lower(${shipments.trackingId})`, needle),
      like(sql`lower(${shipments.carrierTrackingId})`, needle),
      like(sql`lower(${shipments.origin})`, needle),
      like(sql`lower(${shipments.destination})`, needle),
      like(sql`lower(${shipments.referenceNumber})`, needle),
      like(sql`lower(${shipments.invoiceNumber})`, needle),
    );
    if (search) conditions.push(search);
  }

  if (query.status === "awaiting_carrier_id") {
    conditions.push(isNull(shipments.carrierTrackingId));
  } else if (query.status === "open") {
    conditions.push(inArray(shipments.status, OPEN_STATUSES));
  } else if (query.status) {
    conditions.push(eq(shipments.status, query.status));
  }

  if (query.carrier) conditions.push(eq(shipments.carrierId, query.carrier));
  if (query.client) conditions.push(eq(shipments.clientId, query.client));
  if (query.assignedTo)
    conditions.push(eq(shipments.assignedTo, query.assignedTo));
  if (query.syncState)
    conditions.push(eq(shipments.syncState, query.syncState));

  const from = normaliseRangeStart(query.from);
  const to = normaliseRangeEnd(query.to);
  if (from !== undefined) conditions.push(gte(shipments.createdAt, from));
  if (to !== undefined) conditions.push(lte(shipments.createdAt, to));

  return conditions;
}

function normaliseRangeStart(
  value: ShipmentFilterValues["from"],
): number | undefined {
  return toMs(value, "start");
}

function normaliseRangeEnd(
  value: ShipmentFilterValues["to"],
): number | undefined {
  return toMs(value, "end");
}

function toMs(
  value: string | number | undefined,
  edge: "start" | "end",
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const iso =
      edge === "start" ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
    return Date.parse(iso);
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

async function loadSideData(rows: ShipmentRow[], exec: Executor = db) {
  const clientIds = [...new Set(rows.map((row) => row.clientId))];
  const carrierIds = [...new Set(rows.map((row) => row.carrierId))];
  const userIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.assignedTo, row.createdBy])
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const [clientRows, carrierRows, userRows] = await Promise.all([
    clientIds.length
      ? exec
          .select()
          .from(clients)
          .where(inArray(clients.id, clientIds))
      : Promise.resolve([] as (typeof clients.$inferSelect)[]),
    carrierIds.length
      ? exec
          .select()
          .from(carriers)
          .where(inArray(carriers.id, carrierIds))
      : Promise.resolve([] as (typeof carriers.$inferSelect)[]),
    userIds.length
      ? exec
          .select()
          .from(users)
          .where(inArray(users.id, userIds))
      : Promise.resolve([] as (typeof users.$inferSelect)[]),
  ]);

  const clientMap = new Map(clientRows.map((row) => [row.id, row]));
  const carrierMap = new Map(carrierRows.map((row) => [row.id, row]));
  const userMap = new Map(userRows.map((row) => [row.id, row]));
  return { clientMap, carrierMap, userMap };
}

/** Resolve a client by free-text name within the tenant, or create one. */
function resolveOrCreateClient(
  actor: Actor,
  clientName: string,
  exec: Executor,
): string {
  const trimmed = clientName.trim();
  const [existing] = exec
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(eq(clients.tenantId, actor.tenantId), eq(clients.name, trimmed)),
    )
    .limit(1)
    .all();
  if (existing) return existing.id;

  const id = newId();
  const now = Date.now();
  exec
    .insert(clients)
    .values({
      id,
      tenantId: actor.tenantId,
      name: trimmed,
      createdBy: actor.userId,
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

// ── listShipments ──────────────────────────────────────────────────────────

export async function listShipments(
  actor: Actor,
  query: ShipmentFilterValues,
): Promise<ListEnvelope<ShipmentDTO>> {
  const conditions = baseConditions(actor, query);
  const where = and(...conditions);

  const sortColumn =
    SORT_COLUMNS[(query.sort as keyof typeof SORT_COLUMNS) ?? "createdAt"] ??
    shipments.createdAt;
  const direction = query.dir === "asc" ? asc : desc;
  const offset = (query.page - 1) * query.pageSize;

  const [totalRow] = await db
    .select({ value: count() })
    .from(shipments)
    .where(where);
  const rows = await db
    .select()
    .from(shipments)
    .where(where)
    .orderBy(direction(sortColumn))
    .limit(query.pageSize)
    .offset(offset);

  const { clientMap, carrierMap, userMap } = await loadSideData(rows);

  const counts = rows.length
    ? await db
        .select({ shipmentId: checkpoints.shipmentId, value: count() })
        .from(checkpoints)
        .where(
          inArray(
            checkpoints.shipmentId,
            rows.map((row) => row.id),
          ),
        )
        .groupBy(checkpoints.shipmentId)
    : [];
  const countMap = new Map(
    counts.map((entry) => [entry.shipmentId, entry.value]),
  );

  const data = rows.map((row) =>
    rowToShipment(
      row,
      {
        clientId: row.clientId,
        clientName: clientMap.get(row.clientId)?.name ?? "Unknown client",
        carrierId: row.carrierId,
        carrierCode: carrierMap.get(row.carrierId)?.code ?? "OTHER",
        carrierName: carrierMap.get(row.carrierId)?.name ?? "Unknown carrier",
        assignedName: row.assignedTo
          ? userMap.get(row.assignedTo)?.name
          : null,
        assignedEmail: row.assignedTo
          ? userMap.get(row.assignedTo)?.email
          : null,
        assignedAvatar: row.assignedTo
          ? (userMap.get(row.assignedTo)?.avatarUrl ?? null)
          : null,
        createdByName: userMap.get(row.createdBy)?.name ?? "System",
        checkpointCount: countMap.get(row.id) ?? 0,
      },
      { reveal: actor.reveal },
    ),
  );

  return listEnvelope(data, {
    page: query.page,
    pageSize: query.pageSize,
    total: totalRow?.value ?? 0,
  });
}

// ── getShipmentRow / getShipmentDetail ─────────────────────────────────────

export async function getShipmentRow(
  actor: Actor,
  id: string,
): Promise<ShipmentRow> {
  const scope = visibilityCondition(actor);
  const [row] = await db
    .select()
    .from(shipments)
    .where(
      andAll(
        eq(shipments.id, id),
        eq(shipments.tenantId, actor.tenantId),
        isNull(shipments.deletedAt),
        scope,
      )!,
    )
    .limit(1);

  if (!row)
    throw new ApiError(
      "SHIPMENT_NOT_FOUND",
      "That shipment does not exist or is outside your scope.",
    );
  return row;
}

export async function getShipmentDetail(
  actor: Actor,
  id: string,
): Promise<ShipmentDetailDTO> {
  const row = await getShipmentRow(actor, id);
  const { clientMap, carrierMap, userMap } = await loadSideData([row]);

  const [timeline, invoiceRows, attachmentRows] = await Promise.all([
    db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.shipmentId, id))
      .orderBy(desc(checkpoints.occurredAt)),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        totalPaise: invoices.totalPaise,
        dueDate: invoices.dueDate,
      })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .where(eq(invoiceLines.shipmentId, id)),
    db
      .select({
        id: attachments.id,
        filename: attachments.filename,
        mime: attachments.mime,
        size: attachments.size,
        createdAt: attachments.createdAt,
      })
      .from(attachments)
      .where(
        and(
          eq(attachments.tenantId, actor.tenantId),
          eq(attachments.entityType, "shipment"),
          eq(attachments.entityId, id),
        ),
      ),
  ]);

  const base = rowToShipment(
    row,
    {
      clientId: row.clientId,
      clientName: clientMap.get(row.clientId)?.name ?? "Unknown client",
      carrierId: row.carrierId,
      carrierCode: carrierMap.get(row.carrierId)?.code ?? "OTHER",
      carrierName: carrierMap.get(row.carrierId)?.name ?? "Unknown carrier",
      assignedName: row.assignedTo
        ? userMap.get(row.assignedTo)?.name
        : null,
      assignedEmail: row.assignedTo
        ? userMap.get(row.assignedTo)?.email
        : null,
      assignedAvatar: row.assignedTo
        ? (userMap.get(row.assignedTo)?.avatarUrl ?? null)
        : null,
      createdByName: userMap.get(row.createdBy)?.name ?? "System",
      checkpointCount: timeline.length,
    },
    { reveal: actor.reveal },
  );

  return {
    ...base,
    checkpoints: timeline.map(rowToCheckpoint),
    invoices: invoiceRows.map((entry) => ({
      id: entry.id,
      number: entry.number,
      status: entry.status as "paid" | "pending" | "overdue",
      totalPaise: entry.totalPaise,
      dueDate: entry.dueDate,
    })),
    attachments: attachmentRows.map((a) => ({
      id: a.id,
      filename: a.filename,
      mime: a.mime,
      size: a.size,
      createdAt: a.createdAt,
    })),
  };
}

// ── allocateTrackingId ─────────────────────────────────────────────────────

/** Allocates a tenant-unique internal tracking id (PRD §8). */
export function allocateTrackingId(
  prefix: string,
  exec: Executor = db,
): string {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = generateTrackingId(prefix);
    const [existing] = exec
      .select({ id: shipments.id })
      .from(shipments)
      .where(eq(shipments.trackingId, candidate))
      .limit(1)
      .all();
    if (!existing) return candidate;
  }
  throw new ApiError(
    "TRACKING_ID_CONFLICT",
    "Could not allocate a unique tracking id; try again.",
  );
}

// ── createShipment ─────────────────────────────────────────────────────────

export async function createShipment(
  actor: Actor,
  input: {
    clientId?: string;
    client: string;
    carrierId: string;
    origin: string;
    destination: string;
    originPincode?: string;
    destinationPincode?: string;
    referenceNumber?: string;
    invoiceNumber?: string;
    packages?: number;
    weightGrams?: number;
    declaredValuePaise?: number;
    serviceLevel: string;
    paymentMode: string;
    expectedDelivery?: number;
    assignedTo?: string | null;
    notes?: string;
    carrierTrackingId?: string;
    bookWithCarrier?: boolean;
  },
  prefix: string,
): Promise<ShipmentDTO> {
  // Resolve-or-create the client from free-text name
  let clientId: string;
  if (input.clientId) {
    // Pre-resolved ID from the route handler
    clientId = input.clientId;
    const [client] = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.tenantId, actor.tenantId),
        ),
      )
      .limit(1);
    if (!client)
      throw new ApiError(
        "CLIENT_NOT_FOUND",
        "Pick a client that belongs to this workspace.",
      );
  } else {
    clientId = resolveOrCreateClient(actor, input.client, db);
  }

  const [carrier] = await db
    .select()
    .from(carriers)
    .where(
      and(
        eq(carriers.id, input.carrierId),
        eq(carriers.tenantId, actor.tenantId),
      ),
    )
    .limit(1);
  if (!carrier)
    throw new ApiError(
      "CARRIER_NOT_FOUND",
      "Pick a carrier that belongs to this workspace.",
    );

  const now = Date.now();
  const transitDays =
    SERVICE_LEVEL_TRANSIT_DAYS[
      input.serviceLevel as keyof typeof SERVICE_LEVEL_TRANSIT_DAYS
    ] ?? 5;
  const shipmentId = newId();
  const trackingId = allocateTrackingId(prefix);

  db.transaction((tx) => {
    tx.insert(shipments)
      .values({
        id: shipmentId,
        tenantId: actor.tenantId,
        trackingId,
        carrierTrackingId: input.carrierTrackingId ?? null,
        carrierTrackingIdSetAt: input.carrierTrackingId ? now : null,
        clientId,
        carrierId: input.carrierId,
        referenceNumber: input.referenceNumber ?? null,
        origin: input.origin,
        destination: input.destination,
        originPincode: input.originPincode ?? null,
        destinationPincode: input.destinationPincode ?? null,
        invoiceNumber: input.invoiceNumber ?? null,
        packages: input.packages ?? 1,
        weightGrams: input.weightGrams ?? 0,
        declaredValuePaise: input.declaredValuePaise ?? null,
        serviceLevel: input.serviceLevel,
        paymentMode: input.paymentMode,
        status: "pickup",
        assignedTo: input.assignedTo ?? actor.userId,
        createdBy: actor.userId,
        createdAt: now,
        updatedAt: now,
        expectedDelivery:
          input.expectedDelivery ?? addDays(now, transitDays),
        notes: input.notes ?? null,
        syncState: "manual",
      })
      .run();

    tx.insert(checkpoints)
      .values({
        id: newId(),
        tenantId: actor.tenantId,
        shipmentId,
        status: "pickup",
        label: "Shipment created",
        location: input.origin,
        note: input.notes ?? null,
        occurredAt: now,
        recordedAt: now,
        source: "manual",
        byUserId: actor.userId,
        byUserName: actor.name,
        createdAt: now,
      })
      .run();

    recordAudit(tx, actor, {
      action: "shipment.created",
      entityType: "shipment",
      entityId: shipmentId,
      entityLabel: trackingId,
      summary: `Created shipment ${trackingId} from ${input.origin} to ${input.destination}`,
      changes: {
        route: { from: null, to: `${input.origin} → ${input.destination}` },
      },
    });
  });

  return getShipment(actor, shipmentId);
}

// ── getShipment (convenience — list DTO without detail extras) ──────────────

export async function getShipment(
  actor: Actor,
  id: string,
): Promise<ShipmentDTO> {
  const detail = await getShipmentDetail(actor, id);
  const { checkpoints: _cp, invoices: _inv, attachments: _att, ...rest } =
    detail;
  return rest;
}

// ── updateShipment ─────────────────────────────────────────────────────────

export async function updateShipment(
  actor: Actor,
  id: string,
  input: Record<string, unknown>,
): Promise<ShipmentDTO> {
  const row = await getShipmentRow(actor, id);
  const now = Date.now();

  // Build patch from input — only set fields that are explicitly present
  const patch: Record<string, unknown> = { updatedAt: now };
  const fields = [
    "referenceNumber",
    "origin",
    "destination",
    "originPincode",
    "destinationPincode",
    "invoiceNumber",
    "packages",
    "weightGrams",
    "declaredValuePaise",
    "serviceLevel",
    "paymentMode",
    "expectedDelivery",
    "notes",
    "assignedTo",
    "clientId",
    "carrierId",
    "carrierTrackingId",
  ] as const;
  for (const field of fields) {
    if (field in input && input[field] !== undefined) {
      patch[field] = input[field];
    }
  }

  const changes = diffChanges(
    row as unknown as Record<string, unknown>,
    patch,
  );

  // Null diff = nothing changed → early return, no audit row
  if (!changes) return getShipment(actor, id);

  db.transaction((tx) => {
    tx.update(shipments).set(patch).where(eq(shipments.id, id)).run();
    recordAudit(tx, actor, {
      action: "shipment.updated",
      entityType: "shipment",
      entityId: id,
      entityLabel: row.trackingId,
      summary: `Updated ${Object.keys(changes).length} field(s) on ${row.trackingId}`,
      changes,
    });
  });

  return getShipment(actor, id);
}

// ── logStatus / recordCheckpoint ───────────────────────────────────────────

/**
 * Log a status checkpoint (PRD §6.1 / §8.4).
 * Validates the transition, writes the checkpoint + updates the shipment,
 * and writes the audit row — all inside one transaction.
 */
export async function logStatus(
  actor: Actor,
  shipmentId: string,
  input: {
    status: ShipmentStatus;
    label?: string;
    location?: string;
    note?: string;
    delayReason?: string;
    occurredAt?: number;
    source?: string;
  },
): Promise<ShipmentDTO> {
  const row = await getShipmentRow(actor, shipmentId);

  const scope = shipmentScopeCondition(actor, "shipment:log_status");
  if (scope) {
    const [allowed] = await db
      .select({ id: shipments.id })
      .from(shipments)
      .where(and(eq(shipments.id, shipmentId), scope))
      .limit(1);
    if (!allowed)
      throw new ApiError(
        "FORBIDDEN",
        "You can only log status on shipments assigned to you.",
      );
  }

  const occurredAt = input.occurredAt ?? Date.now();
  const status = input.status as ShipmentStatus;

  // Validate transition
  assertTransition(
    row.status as ShipmentStatus,
    status,
    input.delayReason,
  );

  const now = Date.now();
  const label = input.label ?? checkpointLabelForStatus(status);
  const location = checkpointLocationForStatus(
    status,
    row.origin,
    row.destination,
    input.location,
  );

  db.transaction((tx) => {
    tx.insert(checkpoints)
      .values({
        id: newId(),
        tenantId: actor.tenantId,
        shipmentId,
        status,
        label,
        location: location ?? null,
        note: input.note ?? null,
        delayReason: input.delayReason ?? null,
        occurredAt,
        recordedAt: now,
        source: (input.source as string) ?? "manual",
        byUserId: actor.userId,
        byUserName: actor.name,
        createdAt: now,
      })
      .run();

    tx.update(shipments)
      .set({
        status,
        updatedAt: now,
        deliveredAt: status === "delivered" ? occurredAt : row.deliveredAt,
        delayReason:
          status === "delayed"
            ? (input.delayReason ?? null)
            : row.delayReason,
      })
      .where(eq(shipments.id, shipmentId))
      .run();

    recordAudit(tx, actor, {
      action: "shipment.status_changed",
      entityType: "shipment",
      entityId: shipmentId,
      entityLabel: row.trackingId,
      severity: status === "delayed" ? "warn" : "info",
      summary:
        status === "delayed"
          ? `Marked ${row.trackingId} delayed — ${input.delayReason}`
          : `Logged ${SHIPMENT_STATUS_LABELS[status].toLowerCase()} for ${row.trackingId}`,
      changes: { status: { from: row.status, to: status } },
    });
  });

  return getShipment(actor, shipmentId);
}

// Alias for backward compatibility with the existing codebase
export const addCheckpoint = logStatus;

// ── softDeleteShipment ─────────────────────────────────────────────────────

export async function softDeleteShipment(
  actor: Actor,
  id: string,
): Promise<void> {
  const row = await getShipmentRow(actor, id);
  const now = Date.now();
  db.transaction((tx) => {
    tx.update(shipments)
      .set({ deletedAt: now, deletedBy: actor.userId, updatedAt: now })
      .where(eq(shipments.id, id))
      .run();
    recordAudit(tx, actor, {
      action: "shipment.deleted",
      entityType: "shipment",
      entityId: id,
      entityLabel: row.trackingId,
      severity: "warn",
      summary: `Deleted ${row.trackingId} (soft — still in the audit trail)`,
    });
  });
}

// ── listCheckpoints ────────────────────────────────────────────────────────

export async function listCheckpoints(
  actor: Actor,
  shipmentId: string,
): Promise<CheckpointDTO[]> {
  await getShipmentRow(actor, shipmentId);
  const rows = await db
    .select()
    .from(checkpoints)
    .where(eq(checkpoints.shipmentId, shipmentId))
    .orderBy(desc(checkpoints.occurredAt));
  return rows.map(rowToCheckpoint);
}

// ── setCarrierTrackingId (§8.4) ───────────────────────────────────────────

/**
 * §8.4 capture path — manually set the carrier's tracking ID on a shipment.
 * Validates the ID, sets `carrierTrackingIdSetAt`, and moves `syncState`.
 */
export async function setCarrierTrackingId(
  actor: Actor,
  id: string,
  value: string,
): Promise<ShipmentDTO> {
  const row = await getShipmentRow(actor, id);

  if (!isPlausibleCarrierTrackingId(value)) {
    throw new ApiError(
      "VALIDATION_FAILED",
      "That doesn't look like a valid carrier tracking ID.",
      {
        fieldErrors: {
          carrierTrackingId:
            "Must be 6–24 alphanumeric characters (dashes allowed).",
        },
      },
    );
  }

  const now = Date.now();
  db.transaction((tx) => {
    tx.update(shipments)
      .set({
        carrierTrackingId: value,
        carrierTrackingIdSetAt: now,
        syncState: "manual" as SyncState,
        updatedAt: now,
      })
      .where(eq(shipments.id, id))
      .run();

    recordAudit(tx, actor, {
      action: "shipment.carrier_tracking_set",
      entityType: "shipment",
      entityId: id,
      entityLabel: row.trackingId,
      summary: `Set carrier tracking ID for ${row.trackingId}`,
      changes: {
        carrierTrackingId: {
          from: row.carrierTrackingId ?? null,
          to: value,
        },
      },
    });
  });

  return getShipment(actor, id);
}

// ── bulkAssign ─────────────────────────────────────────────────────────────

export async function bulkAssign(
  actor: Actor,
  input: ShipmentBulkAssignInput,
): Promise<number> {
  const rows = await db
    .select({ id: shipments.id, trackingId: shipments.trackingId })
    .from(shipments)
    .where(
      and(
        eq(shipments.tenantId, actor.tenantId),
        inArray(shipments.id, input.ids),
        isNull(shipments.deletedAt),
      ),
    );

  if (rows.length === 0) return 0;

  const now = Date.now();
  db.transaction((tx) => {
    tx.update(shipments)
      .set({ assignedTo: input.assignedTo, updatedAt: now })
      .where(inArray(shipments.id, rows.map((row) => row.id)))
      .run();

    for (const row of rows) {
      recordAudit(tx, actor, {
        action: "shipment.assigned",
        entityType: "shipment",
        entityId: row.id,
        entityLabel: row.trackingId,
        summary: `Assigned ${row.trackingId}`,
        changes: { assignedTo: { from: null, to: input.assignedTo } },
      });
    }
  });

  return rows.length;
}

// ── bulkStatus ─────────────────────────────────────────────────────────────

export async function bulkStatus(
  actor: Actor,
  input: ShipmentBulkStatusInput,
): Promise<number> {
  // Validate all transitions first (fail fast)
  const rows = await db
    .select({
      id: shipments.id,
      trackingId: shipments.trackingId,
      status: shipments.status,
    })
    .from(shipments)
    .where(
      and(
        eq(shipments.tenantId, actor.tenantId),
        inArray(shipments.id, input.ids),
        isNull(shipments.deletedAt),
      ),
    );

  for (const row of rows) {
    assertTransition(
      row.status as ShipmentStatus,
      input.status as ShipmentStatus,
      input.delayReason,
    );
  }

  if (rows.length === 0) return 0;

  const now = Date.now();
  db.transaction((tx) => {
    tx.update(shipments)
      .set({
        status: input.status as string,
        updatedAt: now,
        deliveredAt: input.status === "delivered" ? now : undefined,
        delayReason:
          input.status === "delayed" ? (input.delayReason ?? null) : null,
      })
      .where(inArray(shipments.id, rows.map((row) => row.id)))
      .run();

    for (const row of rows) {
      tx.insert(checkpoints)
        .values({
          id: newId(),
          tenantId: actor.tenantId,
          shipmentId: row.id,
          status: input.status as string,
          label: input.status as string,
          location: input.location ?? null,
          note: input.note ?? null,
          delayReason: input.delayReason ?? null,
          occurredAt: now,
          recordedAt: now,
          source: "manual",
          byUserId: actor.userId,
          byUserName: actor.name,
          createdAt: now,
        })
        .run();

      recordAudit(tx, actor, {
        action: "shipment.status_changed",
        entityType: "shipment",
        entityId: row.id,
        entityLabel: row.trackingId,
        severity: input.status === "delayed" ? "warn" : "info",
        summary: `Bulk status: ${row.trackingId} → ${SHIPMENT_STATUS_LABELS[input.status as ShipmentStatus]}`,
        changes: { status: { from: row.status, to: input.status } },
      });
    }
  });

  return rows.length;
}

// ── bulkDelete ─────────────────────────────────────────────────────────────

export async function bulkDelete(
  actor: Actor,
  ids: string[],
): Promise<number> {
  const rows = await db
    .select({ id: shipments.id, trackingId: shipments.trackingId })
    .from(shipments)
    .where(
      and(
        eq(shipments.tenantId, actor.tenantId),
        inArray(shipments.id, ids),
        isNull(shipments.deletedAt),
      ),
    );

  if (rows.length === 0) return 0;

  const now = Date.now();
  db.transaction((tx) => {
    tx.update(shipments)
      .set({ deletedAt: now, deletedBy: actor.userId, updatedAt: now })
      .where(inArray(shipments.id, rows.map((row) => row.id)))
      .run();

    for (const row of rows) {
      recordAudit(tx, actor, {
        action: "shipment.deleted",
        entityType: "shipment",
        entityId: row.id,
        entityLabel: row.trackingId,
        severity: "warn",
        summary: `Deleted ${row.trackingId} (soft)`,
      });
    }
  });

  return rows.length;
}

// ── listAwaitingCarrierId (§8.4 quick filter) ──────────────────────────────

export async function listAwaitingCarrierId(
  actor: Actor,
  query: ShipmentFilterValues,
): Promise<ListEnvelope<ShipmentDTO>> {
  return listShipments(actor, { ...query, status: "awaiting_carrier_id" });
}

// ── shipmentCountsByStatus (desk tabs) ─────────────────────────────────────

export async function shipmentCountsByStatus(
  actor: Actor,
): Promise<Record<string, number>> {
  const conditions: SQL[] = [
    eq(shipments.tenantId, actor.tenantId),
    isNull(shipments.deletedAt),
  ];
  const scope = visibilityCondition(actor);
  if (scope) conditions.push(scope);
  const where = and(...conditions);

  const rows = await db
    .select({ status: shipments.status, value: count() })
    .from(shipments)
    .where(where)
    .groupBy(shipments.status);

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.status] = row.value;
  }
  // Composite counts
  result.open =
    (result.pickup ?? 0) +
    (result.warehouse ?? 0) +
    (result.in_transit ?? 0) +
    (result.delayed ?? 0);
  result.awaiting_carrier_id = await db
    .select({ value: count() })
    .from(shipments)
    .where(and(...conditions, isNull(shipments.carrierTrackingId)))
    .then(([r]) => r?.value ?? 0);
  result.total = rows.reduce((sum, r) => sum + r.value, 0);
  return result;
}

// ── shipmentsCsv ───────────────────────────────────────────────────────────

export const SHIPMENT_CSV_COLUMNS: CsvColumn<ShipmentDTO>[] = [
  {
    id: "trackingId",
    header: "Tracking ID",
    value: (row) => row.trackingId.value,
  },
  {
    id: "carrierTrackingId",
    header: "Carrier docket",
    value: (row) => row.carrierTrackingId.value,
  },
  { id: "client", header: "Client", value: (row) => row.client.name },
  { id: "carrier", header: "Carrier", value: (row) => row.carrier.name },
  { id: "origin", header: "Origin", value: (row) => row.route.origin },
  {
    id: "destination",
    header: "Destination",
    value: (row) => row.route.destination,
  },
  {
    id: "status",
    header: "Status",
    value: (row) => SHIPMENT_STATUS_LABELS[row.status],
  },
  { id: "serviceLevel", header: "Service", value: (row) => row.serviceLevel },
  {
    id: "paymentMode",
    header: "Payment",
    value: (row) => row.paymentMode,
  },
  { id: "packages", header: "Packages", value: (row) => row.packages },
  {
    id: "weight",
    header: "Weight (kg)",
    value: (row) => (row.weightGrams / 1000).toFixed(3),
  },
  {
    id: "declaredValue",
    header: "Declared value",
    value: (row) => formatMoneyPlain(row.declaredValuePaise ?? 0),
  },
  {
    id: "assignedTo",
    header: "Assigned to",
    value: (row) => row.assignedTo?.name ?? "",
  },
  {
    id: "createdAt",
    header: "Created",
    value: (row) => formatDateTimeSql(row.createdAt),
  },
  {
    id: "expectedDelivery",
    header: "Expected delivery",
    value: (row) => formatDateIst(row.expectedDelivery),
  },
  {
    id: "deliveredAt",
    header: "Delivered",
    value: (row) => (row.deliveredAt ? formatDateTimeSql(row.deliveredAt) : ""),
  },
  {
    id: "delayReason",
    header: "Delay reason",
    value: (row) => row.delayReason ?? "",
  },
  {
    id: "referenceNumber",
    header: "Reference",
    value: (row) => row.referenceNumber ?? "",
  },
];

/**
 * Filter-aware CSV export (PRD §9.8 / §14.3).
 * Masks IDs via `actor.reveal` — the CSV columns read `row.trackingId.value`
 * which is already the masked (or raw) display string from `rowToShipment`.
 */
export async function shipmentsCsv(
  actor: Actor,
  query: ShipmentFilterValues,
): Promise<string> {
  const all = await listShipments(actor, {
    ...query,
    page: 1,
    pageSize: 200,
  });
  const pages = all.totalPages;
  const rows: ShipmentDTO[] = [...all.data];
  for (let page = 2; page <= Math.min(pages, 25); page += 1) {
    const next = await listShipments(actor, {
      ...query,
      page,
      pageSize: 200,
    });
    rows.push(...next.data);
  }
  return toCsv(rows, SHIPMENT_CSV_COLUMNS);
}

// Backward compat alias
export const exportShipmentsCsv = shipmentsCsv;
