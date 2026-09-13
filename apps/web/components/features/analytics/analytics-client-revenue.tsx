"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SectionCard } from "@/components/shared/page-header";
import { ChartState, SERIES_COLORS } from "@/components/spectrumui/charts/chart-engine";
import { moneyCompact } from "@/lib/format";
import type { AnalyticsStats } from "@logiflow/contracts";

interface Props {
  data: AnalyticsStats["clientRevenue"];
  loading?: boolean;
  onRetry?: () => void;
}

export function AnalyticsClientRevenue({ data, loading, onRetry }: Props) {
  // Sort by revenue descending, take top 10
  const chartData = [...data]
    .sort((a, b) => b.revenuePaise - a.revenuePaise)
    .slice(0, 10)
    .map((c) => ({
      name: c.client.length > 16 ? c.client.slice(0, 14) + "…" : c.client,
      fullName: c.client,
      revenue: c.revenuePaise,
    }));

  const hasData = chartData.length > 0;

  return (
    <SectionCard
      title="Revenue per client"
      description="Top 10 clients by invoiced revenue"
    >
      <ChartState
        status={loading ? "loading" : !hasData ? "empty" : "ready"}
        height={300}
        variant="bars"
        empty={{
          title: "No revenue data yet",
          description: "Revenue metrics will appear once invoices are created.",
        }}
        error={{ title: "Could not load chart" }}
        onRetry={onRetry}
      >
        <div className="w-full" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 4, left: 8, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="var(--border)"
              />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => moneyCompact(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "var(--card-foreground)",
                }}
                formatter={(value, _name, props: { payload?: { fullName?: string } }) => [
                  moneyCompact(typeof value === "number" ? value : 0),
                  props.payload?.fullName ?? "",
                ]}
              />
              <Bar
                dataKey="revenue"
                fill={SERIES_COLORS[1]}
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartState>
    </SectionCard>
  );
}
