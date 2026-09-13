"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { SectionCard } from "@/components/shared/page-header";
import { ChartState, SERIES_COLORS } from "@/components/spectrumui/charts/chart-engine";
import type { AnalyticsStats } from "@logiflow/contracts";

interface Props {
  data: AnalyticsStats["carrierPerformance"];
  loading?: boolean;
  onRetry?: () => void;
}

export function AnalyticsCarrierPerformance({ data, loading, onRetry }: Props) {
  const chartData = data.map((c) => ({
    name: c.carrier,
    onTime: c.onTime,
    delayed: c.delayed,
    avgTransitHours: c.avgTransitHours,
  }));

  const hasData = chartData.length > 0;

  return (
    <SectionCard
      title="Carrier performance"
      description="On-time vs delayed shipments per carrier"
    >
      <ChartState
        status={loading ? "loading" : !hasData ? "empty" : "ready"}
        height={300}
        variant="bars"
        empty={{
          title: "No carrier data yet",
          description: "Carrier performance metrics will appear once shipments are delivered.",
        }}
        error={{ title: "Could not load chart" }}
        onRetry={onRetry}
      >
        <div className="w-full" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "var(--card-foreground)",
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
              />
              <Bar
                dataKey="onTime"
                name="On time"
                fill={SERIES_COLORS[2]}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
              <Bar
                dataKey="delayed"
                name="Delayed"
                fill={SERIES_COLORS[4]}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Avg transit time table */}
        {hasData && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Carrier</th>
                  <th className="pb-2 text-right font-medium">Shipments</th>
                  <th className="pb-2 text-right font-medium">On-time %</th>
                  <th className="pb-2 text-right font-medium">Avg transit (hrs)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => {
                  const total = c.onTime + c.delayed;
                  const onTimePct = total > 0 ? Math.round((c.onTime / total) * 1000) / 10 : 0;
                  return (
                    <tr key={c.carrierId} className="border-b border-border/50">
                      <td className="py-2 font-medium">{c.carrier}</td>
                      <td className="py-2 text-right tabular-nums">{c.shipments}</td>
                      <td className="py-2 text-right tabular-nums">{onTimePct}%</td>
                      <td className="py-2 text-right tabular-nums">
                        {c.avgTransitHours.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ChartState>
    </SectionCard>
  );
}
