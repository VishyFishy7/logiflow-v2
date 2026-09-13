/**
 * Dashboard / analytics aggregation layer (PRD §14.2 / §14.6).
 *
 * Every number comes from a single grouped SQL query where possible;
 * NO N+1 loops. Provides KPI cards, shipmentsByStatus, volumeByDay,
 * delayReasons, needsAttention, heatmap, and analytics-specific
 * carrierPerformance / clientVolume / clientRevenue.
 *
 * §14.2 partial-success: each section job is independent; when one
 * fails we return `partial: true` + `failedSections` instead of throwing.
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
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  addDays,
  startOfLocalDay,
  toLocalDateKey,
} from "@logiflow/shared";
import {
  listEnvelope,
  type DashboardStats,
  type KpiCard,
  type LeadDTO,
  type ShipmentDTO,
  type InvoiceDTO,
} from "@logiflow/contracts";
import { db, type Executor } from "../client";
import type { Actor } from "../actor";
import {
  carriers,
  checkpoints,
  clients,
  invoices,
  invoiceLines,
  leads,
  shipments,
} from "../schema/index";
import { rowToShipment, rowToInvoice, rowToLead, rowToClient } from "../mapping";
import { buildKpiCard, type DashboardSection, type AnalyticsSection } from "../services/stats";

// ── Helper: today boundaries in IST ─────────────────────────────────────────

function todayStartEnd(): { start: number; end: number } {
  const now = Date.now();
  const start = startOfLocalDay(now);
  const end = start + 86_400_000 - 1;
  return { start, end };
}

// ── Helper: 30-day ago boundary ─────────────────────────────────────────────

function daysAgo(n: number): number {
  return Date.now() - n * 86_400_000;
}

// ── KPI cards ───────────────────────────────────────────────────────────────

async function computeKpis(
  actor: Actor,
  now: number,
): Promise<KpiCard[]> {
  const { start: todayStart, end: todayEnd } = todayStartEnd();
  const monthStart = (() => {
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  })();
  const prevMonthStart = (() => {
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
  })();
  const thirtyDaysAgo = daysAgo(30);

  // Active shipments: all non-delivered, non-deleted
  const [activeRow] = await db
    .select({ value: count() })
    .from(shipments)
    .where(
      and(
        eq(shipments.tenantId, actor.tenantId),
        isNull(shipments.deletedAt),
        sql`${shipments.status} <> 'delivered'`,
      ),
    );

  // Delayed shipments
  const [delayedRow] = await db
    .select({ value: count() })
    .from(shipments)
    .where(
      and(
        eq(shipments.tenantId, actor.tenantId),
        isNull(shipments.deletedAt),
        eq(shipments.status, "delayed"),
      ),
    );

  // Out for delivery today (in_transit shipments expected today)
  const [outForDeliveryRow] = await db
    .select({ value: count() })
    .from(shipments)
    .where(
      and(
        eq(shipments.tenantId, actor.tenantId),
        isNull(shipments.deletedAt),
        eq(shipments.status, "in_transit"),
        gte(shipments.expectedDelivery, todayStart),
        lte(shipments.expectedDelivery, todayEnd),
      ),
    );

  // Revenue this month: sum of paid invoices in the current month
  const [revenueRow] = await db
    .select({
      value: sql<number>`COALESCE(SUM(${invoices.totalPaise}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, actor.tenantId),
        eq(invoices.status, "paid"),
        gte(invoices.paidAt, monthStart),
      ),
    );

  // Previous month revenue for delta
  const [prevRevenueRow] = await db
    .select({
      value: sql<number>`COALESCE(SUM(${invoices.totalPaise}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, actor.tenantId),
        eq(invoices.status, "paid"),
        gte(invoices.paidAt, prevMonthStart),
        lte(invoices.paidAt, monthStart - 1),
      ),
    );

  // Sparkline: active shipments per day over last 14 days
  const sparkline = await computeSparkline(actor, 14);

  const activeVal = activeRow?.value ?? 0;
  const delayedVal = delayedRow?.value ?? 0;
  const outVal = outForDeliveryRow?.value ?? 0;
  const revenueVal = revenueRow?.value ?? 0;
  const prevRevenueVal = prevRevenueRow?.value ?? 0;

  // Simple delta: compare with 30-day-ago snapshot (for KPIs) or prev month (revenue)
  const revenueDelta = prevRevenueVal > 0
    ? Math.round(((revenueVal - prevRevenueVal) / prevRevenueVal) * 100)
    : null;

  return [
    buildKpiCard(
      { id: "active_shipments", label: "Active shipments", format: "count", tone: "accent", href: "/shipments?status=open" },
      activeVal,
      { sparkline },
    ),
    buildKpiCard(
      { id: "delayed", label: "Delayed", format: "count", tone: "warn", href: "/shipments?status=delayed" },
      delayedVal,
    ),
    buildKpiCard(
      { id: "out_for_delivery", label: "Out for delivery today", format: "count", tone: "accent", href: "/shipments?status=in_transit" },
      outVal,
    ),
    buildKpiCard(
      { id: "revenue_month", label: "Revenue this month", format: "money", tone: "accent", href: "/invoices" },
      revenueVal,
      { deltaPercent: revenueDelta },
    ),
  ];
}

/** Simple 14-day sparkline: count of active shipments created each day. */
async function computeSparkline(actor: Actor, days: number): Promise<number[]> {
  const since = daysAgo(days);
  const rows = await db
    .select({
      date: sql<string>`date(${shipments.createdAt} / 1000, 'unixepoch')`,
      value: count(),
    })
    .from(shipments)
    .where(
      and(
        eq(shipments.tenantId, actor.tenantId),
        isNull(shipments.deletedAt),
        gte(shipments.createdAt, since),
      ),
    )
    .groupBy(sql`date(${shipments.createdAt} / 1000, 'unixepoch')`)
    .orderBy(sql`date(${shipments.createdAt} / 1000, 'unixepoch')`);

  const map = new Map(rows.map((r) => [r.date, r.value]));
  const result: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    result.push(map.get(key) ?? 0);
  }
  return result;
}

// ── Shipments by status ─────────────────────────────────────────────────────

async function computeShipmentsByStatus(actor: Actor) {
  const rows = await db
    .select({ status: shipments.status, value: count() })
    .from(shipments)
    .where(and(eq(shipments.tenantId, actor.tenantId), isNull(shipments.deletedAt)))
    .groupBy(shipments.status);

  return rows.map((r) => ({ status: r.status, count: r.value }));
}

// ── Volume by day (created vs delivered) ────────────────────────────────────

async function computeVolumeByDay(actor: Actor) {
  const since = daysAgo(30);

  const created = await db
    .select({
      date: sql<string>`date(${shipments.createdAt} / 1000, 'unixepoch')`,
      value: count(),
    })
    .from(shipments)
    .where(
      and(
        eq(shipments.tenantId, actor.tenantId),
        isNull(shipments.deletedAt),
        gte(shipments.createdAt, since),
      ),
    )
    .groupBy(sql`date(${shipments.createdAt} / 1000, 'unixepoch')`);

  const delivered = await db
    .select({
      date: sql<string>`date(${shipments.deliveredAt} / 1000, 'unixepoch')`,
      value: count(),
    })
    .from(shipments)
    .where(
      and(
        eq(shipments.tenantId, actor.tenantId),
        isNull(shipments.deletedAt),
        eq(shipments.status, "delivered"),
        gte(shipments.deliveredAt, since),
      ),
    )
    .groupBy(sql`date(${shipments.deliveredAt} / 1000, 'unixepoch')`);

  const createdMap = new Map(created.map((r) => [r.date, r.value]));
  const deliveredMap = new Map(delivered.map((r) => [r.date, r.value]));

  const dates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    dates.push(d.toISOString().slice(0, 10));
  }

  return dates.map((date) => ({
    date,
    created: createdMap.get(date) ?? 0,
    delivered: deliveredMap.get(date) ?? 0,
  }));
}

// ── Delay reasons ───────────────────────────────────────────────────────────

async function computeDelayReasons(actor: Actor) {
  const rows = await db
    .select({ reason: shipments.delayReason, value: count() })
    .from(shipments)
    .where(
      and(
        eq(shipments.tenantId, actor.tenantId),
        isNull(shipments.deletedAt),
        eq(shipments.status, "delayed"),
        sql`${shipments.delayReason} IS NOT NULL`,
      ),
    )
    .groupBy(shipments.delayReason);

  return rows
    .map((r) => ({ reason: r.reason ?? "Unknown", count: r.value }))
    .sort((a, b) => b.count - a.count);
}

// ── Needs attention ─────────────────────────────────────────────────────────

async function computeNeedsAttention(actor: Actor) {
  const now = Date.now();
  const { start: todayStart, end: todayEnd } = todayStartEnd();

  // Delayed shipments (reuse shipments query, no N+1)
  const delayedRows = await db
    .select()
    .from(shipments)
    .where(
      and(
        eq(shipments.tenantId, actor.tenantId),
        isNull(shipments.deletedAt),
        eq(shipments.status, "delayed"),
      ),
    )
    .orderBy(desc(shipments.updatedAt))
    .limit(10);

  // Load side data for delayed shipments
  const delayedShipments = await hydrateShipments(delayedRows, actor);

  // Overdue invoices: pending + past due date
  const overdueInvoiceRows = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, actor.tenantId),
        eq(invoices.status, "pending"),
        lte(invoices.dueDate, now),
      ),
    )
    .orderBy(asc(invoices.dueDate))
    .limit(10);

  const overdueInvoices = await hydrateInvoices(overdueInvoiceRows);

  // Follow-ups due today
  const followUpRows = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.tenantId, actor.tenantId),
        gte(leads.nextFollowUp, todayStart),
        lte(leads.nextFollowUp, todayEnd),
        sql`${leads.status} NOT IN ('won', 'lost')`,
      ),
    )
    .orderBy(asc(leads.nextFollowUp))
    .limit(10);

  const followUpsToday = await hydrateLeads(followUpRows);

  return { delayedShipments, overdueInvoices, followUpsToday };
}

// ── Heatmap (delay events by day) ──────────────────────────────────────────

async function computeHeatmap(actor: Actor) {
  const since = daysAgo(30);

  const rows = await db
    .select({
      date: sql<string>`date(${checkpoints.occurredAt} / 1000, 'unixepoch')`,
      value: count(),
    })
    .from(checkpoints)
    .innerJoin(shipments, eq(checkpoints.shipmentId, shipments.id))
    .where(
      and(
        eq(checkpoints.tenantId, actor.tenantId),
        eq(checkpoints.status, "delayed"),
        gte(checkpoints.occurredAt, since),
      ),
    )
    .groupBy(sql`date(${checkpoints.occurredAt} / 1000, 'unixepoch')`);

  const map = new Map(rows.map((r) => [r.date, r.value]));
  const dates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates.map((date) => ({ date, count: map.get(date) ?? 0 }));
}

// ── Recent activity (compact audit, 10 rows) ───────────────────────────────

async function computeRecentActivity(actor: Actor) {
  // Import auditEvents inline to avoid circular deps
  const { auditEvents } = await import("../schema/index");
  const { rowToAuditEvent } = await import("../mapping");

  const rows = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.tenantId, actor.tenantId))
    .orderBy(desc(auditEvents.occurredAt))
    .limit(10);

  return rows.map(rowToAuditEvent);
}

// ── Analytics: carrier performance ──────────────────────────────────────────

async function computeCarrierPerformance(actor: Actor) {
  const rows = await db
    .select({
      carrierId: shipments.carrierId,
      shipments: count(),
      onTime: sql<number>`COALESCE(SUM(CASE WHEN ${shipments.status} = 'delivered' AND ${shipments.deliveredAt} IS NOT NULL AND ${shipments.deliveredAt} <= ${shipments.expectedDelivery} THEN 1 ELSE 0 END), 0)`,
      delayed: sql<number>`COALESCE(SUM(CASE WHEN ${shipments.status} = 'delayed' THEN 1 ELSE 0 END), 0)`,
      avgTransitHours: sql<number>`COALESCE(AVG(CASE WHEN ${shipments.status} = 'delivered' AND ${shipments.deliveredAt} IS NOT NULL THEN (${shipments.deliveredAt} - ${shipments.createdAt}) / 3600000.0 ELSE NULL END), 0)`,
    })
    .from(shipments)
    .where(and(eq(shipments.tenantId, actor.tenantId), isNull(shipments.deletedAt)))
    .groupBy(shipments.carrierId);

  // Load carrier names
  const carrierIds = rows.map((r) => r.carrierId);
  const carrierRows = carrierIds.length
    ? await db.select().from(carriers).where(sql`${carriers.id} IN ${carrierIds}`)
    : [];
  const carrierMap = new Map(carrierRows.map((r) => [r.id, r]));

  return rows.map((r) => ({
    carrierId: r.carrierId,
    carrier: carrierMap.get(r.carrierId)?.name ?? "Unknown",
    shipments: r.shipments,
    onTime: r.onTime,
    delayed: r.delayed,
    avgTransitHours: Math.round((r.avgTransitHours ?? 0) * 10) / 10,
  }));
}

// ── Analytics: client volume ────────────────────────────────────────────────

async function computeClientVolume(actor: Actor) {
  const rows = await db
    .select({
      clientId: shipments.clientId,
      value: count(),
    })
    .from(shipments)
    .where(and(eq(shipments.tenantId, actor.tenantId), isNull(shipments.deletedAt)))
    .groupBy(shipments.clientId)
    .orderBy(desc(count()));

  const clientIds = rows.map((r) => r.clientId);
  const clientRows = clientIds.length
    ? await db.select().from(clients).where(sql`${clients.id} IN ${clientIds}`)
    : [];
  const clientMap = new Map(clientRows.map((r) => [r.id, r]));

  return rows.map((r) => ({
    clientId: r.clientId,
    client: clientMap.get(r.clientId)?.name ?? "Unknown",
    shipments: r.value,
  }));
}

// ── Analytics: client revenue ───────────────────────────────────────────────

async function computeClientRevenue(actor: Actor) {
  const rows = await db
    .select({
      clientId: invoices.clientId,
      revenuePaise: sql<number>`COALESCE(SUM(${invoices.totalPaise}), 0)`,
    })
    .from(invoices)
    .where(eq(invoices.tenantId, actor.tenantId))
    .groupBy(invoices.clientId)
    .orderBy(desc(sql`SUM(${invoices.totalPaise})`));

  const clientIds = rows.map((r) => r.clientId);
  const clientRows = clientIds.length
    ? await db.select().from(clients).where(sql`${clients.id} IN ${clientIds}`)
    : [];
  const clientMap = new Map(clientRows.map((r) => [r.id, r]));

  return rows.map((r) => ({
    clientId: r.clientId,
    client: clientMap.get(r.clientId)?.name ?? "Unknown",
    revenuePaise: r.revenuePaise,
  }));
}

// ── Hydration helpers (load side data for lists) ────────────────────────────

async function hydrateShipments(rows: (typeof shipments.$inferSelect)[], actor: Actor): Promise<ShipmentDTO[]> {
  if (rows.length === 0) return [];

  const clientIds = [...new Set(rows.map((r) => r.clientId))];
  const carrierIds = [...new Set(rows.map((r) => r.carrierId))];
  const userIds = [...new Set(rows.flatMap((r) => [r.assignedTo, r.createdBy]).filter(Boolean))] as string[];

  const [clientRows, carrierRows, userRows] = await Promise.all([
    clientIds.length ? db.select().from(clients).where(sql`${clients.id} IN ${clientIds}`) : [],
    carrierIds.length ? db.select().from(carriers).where(sql`${carriers.id} IN ${carrierIds}`) : [],
    userIds.length ? db.select().from((await import("../schema/index")).users).where(sql`${(await import("../schema/index")).users.id} IN ${userIds}`) : [],
  ]);

  // Simpler approach: import users at module level
  const { users: usersTable } = await import("../schema/index");
  const userRows2 = userIds.length
    ? await db.select().from(usersTable).where(sql`${usersTable.id} IN ${userIds}`)
    : [];

  const clientMap = new Map(clientRows.map((r) => [r.id, r]));
  const carrierMap = new Map(carrierRows.map((r) => [r.id, r]));
  const userMap = new Map(userRows2.map((r) => [r.id, r]));

  return rows.map((row) =>
    rowToShipment(
      row,
      {
        clientId: row.clientId,
        clientName: clientMap.get(row.clientId)?.name ?? "Unknown",
        carrierId: row.carrierId,
        carrierCode: carrierMap.get(row.carrierId)?.code ?? "OTHER",
        carrierName: carrierMap.get(row.carrierId)?.name ?? "Unknown",
        assignedName: row.assignedTo ? userMap.get(row.assignedTo)?.name ?? null : null,
        createdByName: row.createdBy ? userMap.get(row.createdBy)?.name ?? "System" : "System",
      },
      { reveal: actor.reveal },
    ),
  );
}

async function hydrateInvoices(rows: (typeof invoices.$inferSelect)[]): Promise<InvoiceDTO[]> {
  if (rows.length === 0) return [];

  const clientIds = [...new Set(rows.map((r) => r.clientId))];
  const clientRows = clientIds.length
    ? await db.select().from(clients).where(sql`${clients.id} IN ${clientIds}`)
    : [];
  const clientMap = new Map(clientRows.map((r) => [r.id, r]));

  return rows.map((row) =>
    rowToInvoice(row, { clientName: clientMap.get(row.clientId)?.name ?? "Unknown" }),
  );
}

async function hydrateLeads(rows: (typeof leads.$inferSelect)[]): Promise<LeadDTO[]> {
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r) => r.assignedTo).filter(Boolean))] as string[];
  const { users: usersTable } = await import("../schema/index");
  const userRows = userIds.length
    ? await db.select().from(usersTable).where(sql`${usersTable.id} IN ${userIds}`)
    : [];
  const userMap = new Map(userRows.map((r) => [r.id, r]));

  return rows.map((row) =>
    rowToLead(row, { assignedName: row.assignedTo ? userMap.get(row.assignedTo)?.name ?? null : undefined }),
  );
}

// ── Partial-success aggregation engine (§14.2) ─────────────────────────────

type SectionJob<T> = { name: string; run: () => Promise<T> };

interface PartialResult<T> {
  data: Partial<Record<keyof T, unknown>>;
  partial: boolean;
  failedSections: string[];
}

/**
 * Execute a list of section jobs independently. If one fails, catch the
 * error, record the failure, and continue with the remaining sections.
 * Returns a result that indicates whether partial data was returned.
 */
async function runSections<T extends Record<string, unknown>>(
  jobs: SectionJob<unknown>[],
): Promise<{ data: T; partial: boolean; failedSections: string[] }> {
  const data: Record<string, unknown> = {};
  const failedSections: string[] = [];

  const results = await Promise.allSettled(jobs.map((job) => job.run()));

  for (let i = 0; i < jobs.length; i++) {
    const result = results[i]!;
    const job = jobs[i]!;
    if (result.status === "fulfilled") {
      data[job.name] = result.value;
    } else {
      failedSections.push(job.name);
      // Log but don't throw
      const reason = result.status === "rejected" ? result.reason : "unknown";
      console.error(`[stats] Section "${job.name}" failed:`, reason);
    }
  }

  return {
    data: data as T,
    partial: failedSections.length > 0,
    failedSections,
  };
}

// ── Main: dashboard stats ───────────────────────────────────────────────────

export async function dashboardStats(actor: Actor): Promise<DashboardStats> {
  const now = Date.now();

  const sections: SectionJob<unknown>[] = [
    { name: "kpis", run: () => computeKpis(actor, now) },
    { name: "shipmentsByStatus", run: () => computeShipmentsByStatus(actor) },
    { name: "volumeByDay", run: () => computeVolumeByDay(actor) },
    { name: "delayReasons", run: () => computeDelayReasons(actor) },
    { name: "needsAttention", run: () => computeNeedsAttention(actor) },
    { name: "heatmap", run: () => computeHeatmap(actor) },
    { name: "recentActivity", run: () => computeRecentActivity(actor) },
  ];

  const { data, partial, failedSections } = await runSections<Record<string, unknown>>(sections);

  return {
    kpis: (data.kpis as KpiCard[]) ?? [],
    shipmentsByStatus: (data.shipmentsByStatus as DashboardStats["shipmentsByStatus"]) ?? [],
    volumeByDay: (data.volumeByDay as DashboardStats["volumeByDay"]) ?? [],
    delayReasons: (data.delayReasons as DashboardStats["delayReasons"]) ?? [],
    needsAttention: (data.needsAttention as DashboardStats["needsAttention"]) ?? {
      delayedShipments: [],
      overdueInvoices: [],
      followUpsToday: [],
    },
    heatmap: (data.heatmap as DashboardStats["heatmap"]) ?? [],
    partial: partial || undefined,
    failedSections: failedSections.length > 0 ? failedSections : undefined,
  };
}

// ── Main: analytics stats ──────────────────────────────────────────────────

export async function analyticsStats(actor: Actor): Promise<DashboardStats> {
  const now = Date.now();

  const sections: SectionJob<unknown>[] = [
    { name: "kpis", run: () => computeKpis(actor, now) },
    { name: "shipmentsByStatus", run: () => computeShipmentsByStatus(actor) },
    { name: "volumeByDay", run: () => computeVolumeByDay(actor) },
    { name: "delayReasons", run: () => computeDelayReasons(actor) },
    { name: "needsAttention", run: () => computeNeedsAttention(actor) },
    { name: "heatmap", run: () => computeHeatmap(actor) },
    { name: "recentActivity", run: () => computeRecentActivity(actor) },
    { name: "carrierPerformance", run: () => computeCarrierPerformance(actor) },
    { name: "clientVolume", run: () => computeClientVolume(actor) },
    { name: "clientRevenue", run: () => computeClientRevenue(actor) },
  ];

  const { data, partial, failedSections } = await runSections<Record<string, unknown>>(sections);

  return {
    kpis: (data.kpis as KpiCard[]) ?? [],
    shipmentsByStatus: (data.shipmentsByStatus as DashboardStats["shipmentsByStatus"]) ?? [],
    volumeByDay: (data.volumeByDay as DashboardStats["volumeByDay"]) ?? [],
    delayReasons: (data.delayReasons as DashboardStats["delayReasons"]) ?? [],
    needsAttention: (data.needsAttention as DashboardStats["needsAttention"]) ?? {
      delayedShipments: [],
      overdueInvoices: [],
      followUpsToday: [],
    },
    heatmap: (data.heatmap as DashboardStats["heatmap"]) ?? [],
    partial: partial || undefined,
    failedSections: failedSections.length > 0 ? failedSections : undefined,
  };
}
