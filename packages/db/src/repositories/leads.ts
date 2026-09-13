/**
 * Leads — the sales pipeline layer (PRD §6.1 / §14.7).
 *
 * Schema columns from packages/db-schema.md / schema/sales.ts:
 *   leads: id, tenantId, name, company, email, phone, source, status,
 *          assignedTo, notes, nextFollowUp, expectedValuePaise,
 *          convertedClientId, createdBy, createdAt, updatedAt
 *   lead_activities: id, tenantId, leadId, kind, text, byUserId,
 *                    byUserName, createdAt
 */
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lte,
  like,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { newId } from "@logiflow/shared";
import {
  listEnvelope,
  type ListEnvelope,
  type LeadDTO,
  type LeadActivityDTO,
  type LeadActivityKind,
} from "@logiflow/contracts";
import { db } from "../client";
import { ApiError } from "../errors";
import { recordAudit, diffChanges } from "../audit";
import {
  leadVisibility,
  scopeAllowsRow,
  type Actor,
} from "../actor";
import { clients, leads, leadActivities } from "../schema/index";
import { rowToLead, rowToLeadActivity } from "../mapping";
import { userNameMap } from "../repositories/users-read";
import {
  computeNextFollowUp,
  isTerminalLeadStatus,
  leadToClientMapping,
} from "../services/leads";

/* ================================================================ list === */

interface LeadFilterValues {
  q?: string;
  status?: string;
  source?: string;
  assignedTo?: string;
  from?: number | string;
  to?: number | string;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

const SORT_COLUMNS = {
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
  name: leads.name,
  nextFollowUp: leads.nextFollowUp,
  status: leads.status,
} as const;

function toMs(
  value: number | string | undefined,
  bound: "start" | "end",
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return value;
  // ISO string → ms
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return undefined;
  return bound === "end" ? ms + 86_399_999 : ms;
}

export function listLeads(
  actor: Actor,
  query: LeadFilterValues = {},
): ListEnvelope<LeadDTO> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const conditions: SQL[] = [eq(leads.tenantId, actor.tenantId)];

  // Visibility scope (PRD §7.2): lead:read_all / lead:read_assigned
  const vis = leadVisibility(actor);
  if (vis === "assigned") {
    conditions.push(eq(leads.assignedTo, actor.userId));
  } else if (vis === "none") {
    // No access: return empty
    return listEnvelope([], { page, pageSize, total: 0 });
  }
  // "all" → no extra condition

  if (query.status) conditions.push(eq(leads.status, query.status));
  if (query.source) conditions.push(eq(leads.source, query.source));
  if (query.assignedTo) conditions.push(eq(leads.assignedTo, query.assignedTo));

  if (query.q) {
    const needle = `%${query.q.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${leads.name})`, needle),
        like(sql`lower(${leads.company})`, needle),
        like(sql`lower(${leads.email})`, needle),
        like(sql`lower(${leads.phone})`, needle),
      )!,
    );
  }

  const fromMs = toMs(query.from, "start");
  const toMsVal = toMs(query.to, "end");
  if (fromMs !== undefined) conditions.push(gte(leads.createdAt, fromMs));
  if (toMsVal !== undefined) conditions.push(lte(leads.createdAt, toMsVal));

  const where = and(...conditions)!;

  // Sort
  const sortField = (query.sort ?? "createdAt") as keyof typeof SORT_COLUMNS;
  const sortColumn = SORT_COLUMNS[sortField] ?? leads.createdAt;
  const dir = query.dir === "asc" ? asc : desc;

  // Fetch rows + activity counts in one pass
  const rows = db
    .select({
      lead: leads,
      activityCount: sql<number>`(
        SELECT count(*) FROM ${leadActivities}
        WHERE ${leadActivities.leadId} = ${leads.id}
      )`,
    })
    .from(leads)
    .where(where)
    .orderBy(dir(sortColumn))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  const [totalRow] = db
    .select({ value: count() })
    .from(leads)
    .where(where)
    .all();

  // Batch-lookup assignee names
  const userMap = userNameMap(actor.tenantId);

  const data = rows.map((row) =>
    rowToLead(
      row.lead,
      {
        assignedName: row.lead.assignedTo ? userMap.get(row.lead.assignedTo) ?? "Unknown" : null,
        activityCount: row.activityCount,
      },
    ),
  );

  return listEnvelope(data, { page, pageSize, total: totalRow?.value ?? 0 });
}

/* ================================================================ detail === */

function getLeadRow(actor: Actor, id: string) {
  const [row] = db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.tenantId, actor.tenantId)))
    .limit(1)
    .all();
  if (!row) throw new ApiError("LEAD_NOT_FOUND", "Lead not found.");
  return row;
}

export function leadDetail(
  actor: Actor,
  id: string,
): LeadDTO {
  const row = getLeadRow(actor, id);

  // Check visibility
  if (
    !scopeAllowsRow(actor, "lead:read_all", {
      assignedTo: row.assignedTo,
      createdBy: row.createdBy,
    }) &&
    !scopeAllowsRow(actor, "lead:read_assigned", {
      assignedTo: row.assignedTo,
      createdBy: row.createdBy,
    })
  ) {
    throw new ApiError("LEAD_NOT_FOUND", "Lead not found.");
  }

  // Fetch activities ordered by createdAt desc
  const activityRows = db
    .select()
    .from(leadActivities)
    .where(eq(leadActivities.leadId, id))
    .orderBy(desc(leadActivities.createdAt))
    .all();

  const activities = activityRows.map(rowToLeadActivity);

  const userMap = userNameMap(actor.tenantId);

  return rowToLead(
    row,
    {
      assignedName: row.assignedTo ? userMap.get(row.assignedTo) ?? "Unknown" : null,
      activityCount: activities.length,
    },
    activities,
  );
}

/* ================================================================ create === */

export function createLead(
  actor: Actor,
  input: {
    name: string;
    company: string;
    email?: string | null;
    phone?: string | null;
    source: string;
    status?: string;
    assignedTo?: string | null;
    notes?: string | null;
    nextFollowUp?: number | null;
    expectedValuePaise?: number | null;
  },
): LeadDTO {
  const now = Date.now();
  const status = (input.status ?? "new") as LeadDTO["status"];
  const nextFollowUp = input.nextFollowUp ?? computeNextFollowUp(status, now);

  const row = {
    id: newId(),
    tenantId: actor.tenantId,
    name: input.name,
    company: input.company,
    email: input.email ?? null,
    phone: input.phone ?? null,
    source: input.source,
    status,
    assignedTo: input.assignedTo ?? null,
    notes: input.notes ?? null,
    nextFollowUp,
    expectedValuePaise: input.expectedValuePaise ?? null,
    convertedClientId: null,
    createdBy: actor.userId,
    createdAt: now,
    updatedAt: now,
  };

  db.transaction((tx) => {
    tx.insert(leads).values(row).run();
    recordAudit(tx, actor, {
      action: "lead.created",
      entityType: "lead",
      entityId: row.id,
      entityLabel: row.name,
      severity: "info",
      summary: `Lead ${row.name} created from ${row.source}`,
    });
  });

  return rowToLead(row, { activityCount: 0 });
}

/* ================================================================ update === */

export function updateLead(
  actor: Actor,
  id: string,
  input: Record<string, unknown>,
): LeadDTO {
  const existing = getLeadRow(actor, id);

  // Prevent updates to terminal leads (except assignment changes)
  if (isTerminalLeadStatus(existing.status as LeadDTO["status"])) {
    const allowedKeys = new Set(["assignedTo", "notes"]);
    const forbidden = Object.keys(input).filter((k) => !allowedKeys.has(k));
    if (forbidden.length > 0) {
      throw new ApiError(
        "INVALID_STATUS_TRANSITION",
        "Cannot update a lead that has been won or lost.",
      );
    }
  }

  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) patch[key] = value;
  }

  // Auto-compute nextFollowUp if status changed
  if (patch.status && patch.status !== existing.status) {
    patch.nextFollowUp = computeNextFollowUp(
      patch.status as LeadDTO["status"],
      Date.now(),
    );
  }

  const changes = diffChanges(existing as unknown as Record<string, unknown>, patch);
  if (!changes) {
    return rowToLead(existing, { activityCount: 0 });
  }

  db.transaction((tx) => {
    tx.update(leads).set(patch).where(eq(leads.id, id)).run();

    // Use lead.status_changed when the status field changes; lead.updated otherwise
    const statusChanged = "status" in changes;
    const statusFrom = statusChanged ? (changes.status as { from: unknown; to: unknown }).from : undefined;
    const statusTo = statusChanged ? (changes.status as { from: unknown; to: unknown }).to : undefined;
    recordAudit(tx, actor, {
      action: statusChanged ? "lead.status_changed" : "lead.updated",
      entityType: "lead",
      entityId: id,
      entityLabel: existing.name,
      severity: "info",
      summary: statusChanged
        ? `Lead ${existing.name} moved from ${String(statusFrom)} to ${String(statusTo)}`
        : `Lead ${existing.name} updated (${Object.keys(changes).join(", ")})`,
      changes,
    });
  });

  return rowToLead({ ...existing, ...patch } as typeof existing, { activityCount: 0 });
}

/* ================================================================ activity === */

export function logLeadActivity(
  actor: Actor,
  leadId: string,
  input: { kind: LeadActivityKind; text: string },
): LeadActivityDTO {
  const lead = getLeadRow(actor, leadId);

  const now = Date.now();
  const row = {
    id: newId(),
    tenantId: actor.tenantId,
    leadId,
    kind: input.kind,
    text: input.text,
    byUserId: actor.userId,
    byUserName: actor.name,
    createdAt: now,
  };

  db.transaction((tx) => {
    tx.insert(leadActivities).values(row).run();
    recordAudit(tx, actor, {
      action: "lead.activity_logged",
      entityType: "lead",
      entityId: leadId,
      entityLabel: lead.name,
      severity: "info",
      summary: `${input.kind} logged on lead ${lead.name}`,
    });
  });

  return rowToLeadActivity(row);
}

/* ================================================================ assign === */

export function assignLead(
  actor: Actor,
  leadId: string,
  assignedTo: string | null,
): LeadDTO {
  const existing = getLeadRow(actor, leadId);
  const oldAssigned = existing.assignedTo;

  if (oldAssigned === assignedTo) {
    return rowToLead(existing, { activityCount: 0 });
  }

  const now = Date.now();

  db.transaction((tx) => {
    tx.update(leads)
      .set({ assignedTo, updatedAt: now })
      .where(eq(leads.id, leadId))
      .run();
    recordAudit(tx, actor, {
      action: "lead.updated",
      entityType: "lead",
      entityId: leadId,
      entityLabel: existing.name,
      severity: "info",
      summary: assignedTo
        ? `Lead ${existing.name} assigned`
        : `Lead ${existing.name} unassigned`,
      changes: { assignedTo: { from: oldAssigned, to: assignedTo } },
    });
  });

  return rowToLead(
    { ...existing, assignedTo, updatedAt: now } as typeof existing,
    { activityCount: 0 },
  );
}

/* ================================================================ convert === */

/**
 * Convert a lead to a client (PRD §14.7).
 * Creates the client, links convertedClientId on the lead, sets status to
 * "won", writes both audit rows, and logs a "converted" activity — all
 * inside ONE synchronous transaction.
 */
export function convertLeadToClient(
  actor: Actor,
  leadId: string,
  clientInput: {
    contactName?: string;
    email?: string;
    phone?: string;
    city?: string;
    state?: string;
    pincode?: string;
  },
): { lead: LeadDTO; clientId: string } {
  const leadRow = getLeadRow(actor, leadId);

  if (leadRow.convertedClientId) {
    throw new ApiError("VALIDATION_FAILED", "This lead has already been converted.", {
      fieldErrors: { leadId: "Lead already converted to a client." },
    });
  }
  if (isTerminalLeadStatus(leadRow.status as LeadDTO["status"]) && leadRow.status !== "won") {
    throw new ApiError(
      "INVALID_STATUS_TRANSITION",
      "Cannot convert a lost lead.",
    );
  }

  // Map lead fields → client fields using the service helper
  const mapped = leadToClientMapping(
    {
      name: leadRow.name,
      company: leadRow.company,
      email: leadRow.email,
      phone: leadRow.phone,
    },
    clientInput,
  );

  const now = Date.now();
  const clientId = newId();
  const clientRow = {
    id: clientId,
    tenantId: actor.tenantId,
    name: mapped.name,
    contactName: mapped.contactName ?? null,
    email: mapped.email ?? null,
    phone: mapped.phone ?? null,
    gstin: null,
    addressLine1: null,
    addressLine2: null,
    city: mapped.city ?? null,
    state: mapped.state ?? null,
    pincode: mapped.pincode ?? null,
    creditTermsDays: null,
    active: true as const,
    createdBy: actor.userId,
    createdAt: now,
    updatedAt: now,
  };

  const activityRow = {
    id: newId(),
    tenantId: actor.tenantId,
    leadId,
    kind: "status_change" as LeadActivityKind,
    text: `Lead converted to client: ${mapped.name}`,
    byUserId: actor.userId,
    byUserName: actor.name,
    createdAt: now,
  };

  db.transaction((tx) => {
    // 1. Create the client
    tx.insert(clients).values(clientRow).run();
    recordAudit(tx, actor, {
      action: "client.created",
      entityType: "client",
      entityId: clientId,
      entityLabel: mapped.name,
      severity: "info",
      summary: `Client ${mapped.name} created from lead ${leadRow.name}`,
    });

    // 2. Update lead: set status won, link convertedClientId
    tx.update(leads)
      .set({
        status: "won",
        convertedClientId: clientId,
        nextFollowUp: null,
        updatedAt: now,
      })
      .where(eq(leads.id, leadId))
      .run();
    recordAudit(tx, actor, {
      action: "lead.converted",
      entityType: "lead",
      entityId: leadId,
      entityLabel: leadRow.name,
      severity: "info",
      summary: `Lead ${leadRow.name} converted to client ${mapped.name}`,
      changes: {
        status: { from: leadRow.status, to: "won" },
        convertedClientId: { from: null, to: clientId },
      },
    });

    // 3. Log the conversion activity
    tx.insert(leadActivities).values(activityRow).run();
  });

  const updatedLead = {
    ...leadRow,
    status: "won" as const,
    convertedClientId: clientId,
    nextFollowUp: null,
    updatedAt: now,
  };

  return {
    lead: rowToLead(updatedLead, { activityCount: 1 }, [rowToLeadActivity(activityRow)]),
    clientId,
  };
}
