"use client";

import Link from "next/link";
import type { KpiCard } from "@logiflow/contracts";
import { StatCards, type StatCardData } from "@/components/spectrumui/charts/stat-cards";
import { money } from "@/lib/format";

/** Map the API's KpiCard shape onto the chart-engine's StatCardData. */
function toStatCard(kpi: KpiCard): StatCardData {
  const formatFn =
    kpi.format === "money"
      ? (v: number) => money(v)
      : kpi.format === "percent"
        ? (v: number) => `${v.toFixed(1)}%`
        : (v: number) => {
            if (Math.abs(v) >= 1_00_000) {
              return new Intl.NumberFormat("en-IN", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(v);
            }
            return new Intl.NumberFormat("en-IN").format(v);
          };

  return {
    label: kpi.label,
    value: kpi.value,
    series: kpi.sparkline?.length ? kpi.sparkline : undefined,
    format: formatFn,
    goodWhen: kpi.direction === "down" ? "down" : "up",
    deltaLabel: kpi.deltaPercent != null ? "vs last period" : undefined,
    caption: kpi.tone === "warn" ? "Needs attention" : undefined,
  };
}

export function DashboardKpiCards({
  kpis,
  loading,
}: {
  kpis: KpiCard[];
  loading?: boolean;
}) {
  const cards = kpis.map(toStatCard);

  return (
    <StatCards
      cards={cards}
      columns={Math.min(cards.length, 4) as 1 | 2 | 3 | 4}
      status={loading ? "loading" : cards.length === 0 ? "empty" : "ready"}
    />
  );
}
