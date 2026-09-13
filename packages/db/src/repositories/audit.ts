/**
 * Audit repository — READ SIDE ONLY (PRD §9.2 / §11.7).
 *
 * The audit log is append-only: SQLite triggers reject UPDATE/DELETE on
 * audit_events. This module provides list, timeline, and facets queries.
 * No inserts, no updates — the only writer is recordAudit() in src/audit.ts.
 */
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  like,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { listEnvelope, type AuditEventDTO, type AuditListQuery, type ListEnvelope } from "@logiflow/contracts";
import { db } from "../client.js";
import type { Actor } from "../actor.js";
import { auditEvents } from "../schema/index.js";
import { rowToAuditEvent } from "../mapping.js";

// ── Sort columns ────────────────────────────────────────────────────────────

const SORT_COLUMNS = {
  occurredAt: auditEvents.occurredAt,
  actorName: auditEvents.actorName,
  action: auditEvents.action,
  severity: auditEvents.severity,
  entityType: auditEvents.entityType,
} as const;

// ── Date range helpers ──────────────────────────────────────────────────────

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

// ── Build WHERE conditions ──────────────────────────────────────────────────

function buildAuditConditions(actor: Actor, query: AuditListQuery): SQL[] {
  const conditions: SQL[] = [eq(auditEvents.tenantId, actor.tenantId)];

  if (query.severity) {
    conditions.push(eq(auditEvents.severity, query.severity));
  }
  if (query.actorId) {
    conditions.push(eq(auditEvents.actorId, query.actorId));
  }
  if (query.entityType) {
    conditions.push(eq(auditEvents.entityType, query.entityType));
  }
  if (query.entityId) {
    conditions.push(eq(auditEvents.entityId, query.entityId));
  }
  if (query.action) {
    conditions.push(eq(auditEvents.action, query.action));
  }
  if (query.actionNamespace) {
    // Filter by namespace prefix: "shipment" matches "shipment.*"
    conditions.push(
      like(auditEvents.action, `${query.actionNamespace}.%`),
    );
  }
  if (query.source) {
    conditions.push(eq(auditEvents.source, query.source));
  }

  // Date range on occurredAt
  const from = toMs(query.from, "start");
  const to = toMs(query.to, "end");
  if (from !== undefined) conditions.push(gte(auditEvents.occurredAt, from));
  if (to !== undefined) conditions.push(lte(auditEvents.occurredAt, to));

  // Text search across action, summary, actorName, entityLabel
  if (query.q) {
    const needle = `%${query.q.toLowerCase()}%`;
    const search = or(
      like(sql`lower(${auditEvents.action})`, needle),
      like(sql`lower(${auditEvents.summary})`, needle),
      like(sql`lower(${auditEvents.actorName})`, needle),
      like(sql`lower(${auditEvents.entityLabel})`, needle),
    );
    if (search) conditions.push(search);
  }

  return conditions;
}

// ── listAuditEvents ─────────────────────────────────────────────────────────

export async function listAuditEvents(
  actor: Actor,
  query: AuditListQuery,
): Promise<ListEnvelope<AuditEventDTO>> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
  const conditions = buildAuditConditions(actor, query);
  const where = and(...conditions);

  const sortKey = (query.sort as keyof typeof SORT_COLUMNS) ?? "occurredAt";
  const sortColumn = SORT_COLUMNS[sortKey] ?? auditEvents.occurredAt;
  const direction = query.dir === "asc" ? asc : desc;
  const offset = (page - 1) * pageSize;

  const [countRow] = await db
    .select({ value: count() })
    .from(auditEvents)
    .where(where);

  const total = countRow?.value ?? 0;

  const rows = await db
    .select()
    .from(auditEvents)
    .where(where)
    .orderBy(direction(sortColumn))
    .limit(pageSize)
    .offset(offset);

  const data = rows.map(rowToAuditEvent);
  return listEnvelope(data, { page, pageSize, total });
}

// ── auditTimelineForEntity ──────────────────────────────────────────────────

/**
 * Timeline of audit events for a single entity (§11.7 — shipment detail
 * Activity tab, team member drawer).
 */
export async function auditTimelineForEntity(
  actor: Actor,
  entityType: string,
  entityId: string,
): Promise<AuditEventDTO[]> {
  const rows = await db
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.tenantId, actor.tenantId),
        eq(auditEvents.entityType, entityType),
        eq(auditEvents.entityId, entityId),
      ),
    )
    .orderBy(desc(auditEvents.occurredAt))
    .limit(200);

  return rows.map(rowToAuditEvent);
}

// ── auditFacets ─────────────────────────────────────────────────────────────

export interface AuditFacets {
  actors: Array<{ actorId: string | null; actorName: string; count: number }>;
  actions: Array<{ action: string; count: number }>;
  severities: Array<{ severity: string; count: number }>;
  entityTypes: Array<{ entityType: string; count: number }>;
  sources: Array<{ source: string; count: number }>;
}

/**
 * Distinct actors, actions, severities, entity types, and sources for the
 * audit filter UI. Each facet includes a count for the current filter window.
 */
export async function auditFacets(
  actor: Actor,
  query: Partial<AuditListQuery> = {},
): Promise<AuditFacets> {
  // Use only the date-range conditions for facets (not the specific filters
  // themselves, since the facets should reflect the available options).
  const dateConditions: SQL[] = [eq(auditEvents.tenantId, actor.tenantId)];
  const from = toMs(query.from, "start");
  const to = toMs(query.to, "end");
  if (from !== undefined) dateConditions.push(gte(auditEvents.occurredAt, from));
  if (to !== undefined) dateConditions.push(lte(auditEvents.occurredAt, to));
  const where = and(...dateConditions);

  const [actors, actions, severities, entityTypes, sources] = await Promise.all([
    db
      .select({
        actorId: auditEvents.actorId,
        actorName: auditEvents.actorName,
        count: count(),
      })
      .from(auditEvents)
      .where(where)
      .groupBy(auditEvents.actorId, auditEvents.actorName)
      .orderBy(desc(count())),
    db
      .select({ action: auditEvents.action, count: count() })
      .from(auditEvents)
      .where(where)
      .groupBy(auditEvents.action)
      .orderBy(desc(count())),
    db
      .select({ severity: auditEvents.severity, count: count() })
      .from(auditEvents)
      .where(where)
      .groupBy(auditEvents.severity)
      .orderBy(desc(count())),
    db
      .select({ entityType: auditEvents.entityType, count: count() })
      .from(auditEvents)
      .where(where)
      .groupBy(auditEvents.entityType)
      .orderBy(desc(count())),
    db
      .select({ source: auditEvents.source, count: count() })
      .from(auditEvents)
      .where(where)
      .groupBy(auditEvents.source)
      .orderBy(desc(count())),
  ]);

  return { actors, actions, severities, entityTypes, sources };
}
