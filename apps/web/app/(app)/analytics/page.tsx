"use client";

import { useShipmentStats } from "@/lib/api/queries";
import type { AnalyticsStats } from "@logiflow/contracts";
import { PageHeader } from "@/components/shared/page-header";
import { DataState, PartialBanner } from "@/components/shared/data-state";
import { DashboardKpiCards } from "@/components/features/dashboard/dashboard-kpi-cards";
import { DashboardInsights } from "@/components/features/dashboard/dashboard-insights";
import { AnalyticsVolumeTrend } from "@/components/features/analytics/analytics-volume-trend";
import { AnalyticsCarrierPerformance } from "@/components/features/analytics/analytics-carrier-performance";
import { AnalyticsClientVolume } from "@/components/features/analytics/analytics-client-volume";
import { AnalyticsClientRevenue } from "@/components/features/analytics/analytics-client-revenue";
import { AnalyticsDelayReasonsChart } from "@/components/features/analytics/analytics-delay-reasons-chart";
import { DashboardHeatmap } from "@/components/features/dashboard/dashboard-heatmap";

export default function AnalyticsPage() {
  const stats = useShipmentStats<AnalyticsStats>();

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

  const retry = () => stats.refetch();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Analytics"
        description="Volume, service level and revenue trends"
      />

      <DataState
        status={status}
        error={
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
              <p className="text-sm font-medium">Analytics data couldn&apos;t load</p>
              <p className="text-[13px] text-muted-foreground">
                Check your connection and try again.
              </p>
              <button
                type="button"
                onClick={retry}
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
                onRetry={retry}
              />
            )}

            {/* KPI cards */}
            <DashboardKpiCards kpis={data.kpis} loading={isLoading} />

            {/* Insights */}
            <DashboardInsights stats={data} />

            {/* Volume trend — full width */}
            <AnalyticsVolumeTrend
              data={data.volumeByDay}
              loading={isLoading}
              onRetry={retry}
            />

            {/* Carrier performance — full width */}
            <AnalyticsCarrierPerformance
              data={data.carrierPerformance}
              loading={isLoading}
              onRetry={retry}
            />

            {/* Client volume + Revenue side by side */}
            <div className="grid gap-5 lg:grid-cols-2">
              <AnalyticsClientVolume
                data={data.clientVolume}
                loading={isLoading}
                onRetry={retry}
              />
              <AnalyticsClientRevenue
                data={data.clientRevenue}
                loading={isLoading}
                onRetry={retry}
              />
            </div>

            {/* Delay reasons + Heatmap side by side */}
            <div className="grid gap-5 lg:grid-cols-2">
              <AnalyticsDelayReasonsChart
                data={data.delayReasons}
                loading={isLoading}
                onRetry={retry}
              />
              <DashboardHeatmap
                data={data.heatmap}
                loading={isLoading}
                onRetry={retry}
              />
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}
