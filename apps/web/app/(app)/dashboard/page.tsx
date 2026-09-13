"use client";

import { useShipmentStats, useAuditLog } from "@/lib/api/queries";
import type { DashboardStats } from "@logiflow/contracts";
import { PageHeader } from "@/components/shared/page-header";
import { DataState, PartialBanner } from "@/components/shared/data-state";
import { DashboardKpiCards } from "@/components/features/dashboard/dashboard-kpi-cards";
import { DashboardVolumeChart } from "@/components/features/dashboard/dashboard-volume-chart";
import { DashboardShipmentStatusChart } from "@/components/features/dashboard/dashboard-shipment-status-chart";
import { DashboardDelayReasons } from "@/components/features/dashboard/dashboard-delay-reasons";
import { DashboardRecentActivity } from "@/components/features/dashboard/dashboard-recent-activity";
import { DashboardNeedsAttention } from "@/components/features/dashboard/dashboard-needs-attention";
import { DashboardInsights } from "@/components/features/dashboard/dashboard-insights";
import { DashboardHeatmap } from "@/components/features/dashboard/dashboard-heatmap";

export default function DashboardPage() {
  const stats = useShipmentStats<DashboardStats>();
  const recentActivity = useAuditLog({ page: 1, pageSize: 10, sort: "occurredAt", dir: "desc" });

  const isLoading = stats.isLoading;
  const isError = stats.isError;
  const data = stats.data;

  const status: "pending" | "error" | "empty" | "ready" = isLoading
    ? "pending"
    : isError
      ? "error"
      : data
        ? "ready"
        : "empty";

  const retryStats = () => stats.refetch();
  const retryAudit = () => recentActivity.refetch();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard"
        description="Today's volume, exceptions and cash position"
      />

      <DataState
        status={status}
        error={
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
              <p className="text-sm font-medium">Dashboard data couldn&apos;t load</p>
              <p className="text-[13px] text-muted-foreground">
                Check your connection and try again.
              </p>
              <button
                type="button"
                onClick={retryStats}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-muted"
              >
                Try again
              </button>
            </div>
          </div>
        }
      >
        {data && (
          <>
            {/* Partial data banner */}
            {data.partial && data.failedSections && data.failedSections.length > 0 && (
              <PartialBanner
                message={`Some data could not be loaded: ${data.failedSections.join(", ")}`}
                onRetry={retryStats}
              />
            )}

            {/* KPI cards */}
            <DashboardKpiCards kpis={data.kpis} loading={isLoading} />

            {/* Insights strip */}
            <DashboardInsights stats={data} />

            {/* Charts row */}
            <div className="grid gap-5 lg:grid-cols-2">
              <DashboardVolumeChart
                data={data.volumeByDay}
                loading={isLoading}
                onRetry={retryStats}
              />
              <DashboardShipmentStatusChart
                data={data.shipmentsByStatus}
                loading={isLoading}
                onRetry={retryStats}
              />
            </div>

            {/* Secondary charts */}
            <div className="grid gap-5 lg:grid-cols-2">
              <DashboardDelayReasons
                data={data.delayReasons}
                loading={isLoading}
                onRetry={retryStats}
              />
              <DashboardHeatmap
                data={data.heatmap}
                loading={isLoading}
                onRetry={retryStats}
              />
            </div>

            {/* Needs attention + Recent activity */}
            <div className="grid gap-5 lg:grid-cols-2">
              <DashboardNeedsAttention
                delayedShipments={data.needsAttention.delayedShipments}
                overdueInvoices={data.needsAttention.overdueInvoices}
                followUpsToday={data.needsAttention.followUpsToday}
                loading={isLoading}
              />
              <DashboardRecentActivity
                events={recentActivity.data?.data ?? []}
                loading={recentActivity.isLoading}
                total={recentActivity.data?.total}
              />
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}
