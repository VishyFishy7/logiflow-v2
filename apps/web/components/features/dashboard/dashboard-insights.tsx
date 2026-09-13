"use client";

import React from "react";
import { InsightCards, type Insight } from "@/components/spectrumui/blocks/ai-assistants/insight-cards";
import type { DashboardStats } from "@logiflow/contracts";

/**
 * Compute insight cards from the dashboard stats.
 * These surface the most interesting derived numbers from the API response.
 */
export function DashboardInsights({ stats }: { stats: DashboardStats | null }) {
  const insights = React.useMemo<Insight[]>(() => {
    if (!stats) return [];

    const delayedCount = stats.needsAttention.delayedShipments.length;
    const overdueCount = stats.needsAttention.overdueInvoices.length;
    const followUpCount = stats.needsAttention.followUpsToday.length;

    // Compute total from status breakdown
    const totalShipments = stats.shipmentsByStatus.reduce((sum, s) => sum + s.count, 0);

    // Compute delivered vs rest
    const deliveredCount =
      stats.shipmentsByStatus.find((s) => s.status === "delivered")?.count ?? 0;
    const deliveryRate = totalShipments > 0 ? Math.round((deliveredCount / totalShipments) * 1000) / 10 : 0;

    // Compute total revenue from KPIs
    const revenueKpi = stats.kpis.find((k) => k.format === "money");
    const revenueValue = revenueKpi?.value ?? 0;

    const result: Insight[] = [];

    if (delayedCount > 0) {
      result.push({
        id: "delayed",
        label: "Delayed shipments",
        value: String(delayedCount),
        change: undefined,
        note: delayedCount > 5 ? "High delay count — review carrier performance" : undefined,
      });
    }

    if (overdueCount > 0) {
      result.push({
        id: "overdue",
        label: "Overdue invoices",
        value: String(overdueCount),
        change: undefined,
        note: "Pending payment collection",
      });
    }

    if (followUpCount > 0) {
      result.push({
        id: "followups",
        label: "Follow-ups today",
        value: String(followUpCount),
        change: undefined,
      });
    }

    if (totalShipments > 0) {
      result.push({
        id: "delivery-rate",
        label: "Delivery rate",
        value: `${deliveryRate}%`,
        change: deliveryRate >= 80 ? 1 : deliveryRate >= 50 ? 0 : -1,
        spark: stats.volumeByDay.map((d) => d.delivered),
      });
    }

    return result;
  }, [stats]);

  if (insights.length === 0) return null;

  return (
    <InsightCards
      insights={insights}
      variant="Row"
    />
  );
}
