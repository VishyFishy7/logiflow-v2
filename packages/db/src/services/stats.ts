/**
 * Dashboard/analytics stats service — KPI card specs, formatting rules,
 * and section list for partial aggregation (§14.2 / §3.5).
 *
 * Accent is sky blue per §3.5; green is reserved for success states only.
 */
import type { KpiCard } from "@logiflow/contracts";

// ── KPI card definitions ────────────────────────────────────────────────────

export interface KpiCardSpec {
  id: string;
  label: string;
  format: "count" | "money" | "percent";
  tone: KpiCard["tone"];
  href: string;
}

export const KPI_SPECS: readonly KpiCardSpec[] = [
  {
    id: "active_shipments",
    label: "Active shipments",
    format: "count",
    tone: "accent",       // sky blue — §3.5
    href: "/shipments?status=open",
  },
  {
    id: "delayed",
    label: "Delayed",
    format: "count",
    tone: "warn",
    href: "/shipments?status=delayed",
  },
  {
    id: "out_for_delivery",
    label: "Out for delivery today",
    format: "count",
    tone: "accent",
    href: "/shipments?status=in_transit",
  },
  {
    id: "revenue_month",
    label: "Revenue this month",
    format: "money",
    tone: "accent",       // sky blue — amounts are headlines, not status cards (§3.5)
    href: "/invoices",
  },
] as const;

// ── Section lists for partial aggregation ────────────────────────────────────

export type DashboardSection =
  | "kpis"
  | "shipmentsByStatus"
  | "volumeByDay"
  | "delayReasons"
  | "needsAttention"
  | "heatmap"
  | "recentActivity";

export type AnalyticsSection =
  | DashboardSection
  | "carrierPerformance"
  | "clientVolume"
  | "clientRevenue";

export const DASHBOARD_SECTIONS: readonly DashboardSection[] = [
  "kpis",
  "shipmentsByStatus",
  "volumeByDay",
  "delayReasons",
  "needsAttention",
  "heatmap",
  "recentActivity",
];

export const ANALYTICS_SECTIONS: readonly AnalyticsSection[] = [
  ...DASHBOARD_SECTIONS,
  "carrierPerformance",
  "clientVolume",
  "clientRevenue",
];

// ── KPI builder ─────────────────────────────────────────────────────────────

/**
 * Build a KPI card DTO from a spec + computed value.
 * Delta direction: up when positive, down when negative, flat when zero.
 */
export function buildKpiCard(
  spec: KpiCardSpec,
  value: number,
  opts: { deltaPercent?: number | null; sparkline?: number[] } = {},
): KpiCard {
  const deltaPercent = opts.deltaPercent ?? null;
  let direction: KpiCard["direction"] | undefined;
  if (deltaPercent != null) {
    direction = deltaPercent > 0 ? "up" : deltaPercent < 0 ? "down" : "flat";
  }
  return {
    id: spec.id,
    label: spec.label,
    value,
    format: spec.format,
    tone: spec.tone,
    href: spec.href,
    deltaPercent,
    direction,
    sparkline: opts.sparkline,
  };
}
