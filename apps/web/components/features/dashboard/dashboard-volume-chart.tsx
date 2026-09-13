"use client";

import * as React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { SectionCard } from "@/components/shared/page-header";
import { ChartState, SERIES_COLORS, EASE } from "@/components/spectrumui/charts/chart-engine";

interface VolumePoint {
  date: string;
  created: number;
  delivered: number;
}

interface Props {
  data: VolumePoint[];
  loading?: boolean;
  onRetry?: () => void;
}

export function DashboardVolumeChart({ data, loading, onRetry }: Props) {
  const chartData = React.useMemo(() => {
    return data.map((d) => ({
      ...d,
      // Display short date label (e.g. "Sep 1")
      label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));
  }, [data]);

  const hasData = chartData.some((d) => d.created > 0 || d.delivered > 0);

  return (
    <SectionCard title="Volume trend" description="Created vs delivered shipments per day">
      <ChartState
        status={loading ? "loading" : !hasData ? "empty" : "ready"}
        height={260}
        variant="line"
        empty={{
          title: "No volume data yet",
          description: "Volume trends will appear once shipments are created.",
        }}
        error={{ title: "Could not load chart" }}
        onRetry={onRetry}
      >
        <div className="w-full" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradDelivered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES_COLORS[2]} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={SERIES_COLORS[2]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis
                dataKey="label"
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
              <Area
                type="monotone"
                dataKey="created"
                name="Created"
                stroke={SERIES_COLORS[0]}
                strokeWidth={2}
                fill="url(#gradCreated)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="delivered"
                name="Delivered"
                stroke={SERIES_COLORS[2]}
                strokeWidth={2}
                fill="url(#gradDelivered)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartState>
    </SectionCard>
  );
}
