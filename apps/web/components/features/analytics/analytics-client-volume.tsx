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
import type { AnalyticsStats } from "@logiflow/contracts";

interface Props {
  data: AnalyticsStats["clientVolume"];
  loading?: boolean;
  onRetry?: () => void;
}

export function AnalyticsClientVolume({ data, loading, onRetry }: Props) {
  // Sort by shipment count descending, take top 10
  const chartData = [...data]
    .sort((a, b) => b.shipments - a.shipments)
    .slice(0, 10)
    .map((c) => ({
      name: c.client.length > 16 ? c.client.slice(0, 14) + "…" : c.client,
      fullName: c.client,
      shipments: c.shipments,
    }));

  const hasData = chartData.length > 0;

  return (
    <SectionCard
      title="Shipments per client"
      description="Top 10 clients by shipment volume"
    >
      <ChartState
        status={loading ? "loading" : !hasData ? "empty" : "ready"}
        height={300}
        variant="bars"
        empty={{
          title: "No client data yet",
          description: "Client volume metrics will appear once shipments are created.",
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
                allowDecimals={false}
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
                  `${value} shipments`,
                  props.payload?.fullName ?? "",
                ]}
              />
              <Bar
                dataKey="shipments"
                fill={SERIES_COLORS[0]}
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
