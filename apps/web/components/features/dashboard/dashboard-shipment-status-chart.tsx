"use client";

import * as React from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { SectionCard } from "@/components/shared/page-header";
import { ChartState } from "@/components/spectrumui/charts/chart-engine";
import { statusLabel } from "@/lib/format";
import { SHIPMENT_STATUSES, type ShipmentStatus } from "@logiflow/contracts";
import { cn } from "@/lib/utils";

const STATUS_ORDER: ShipmentStatus[] = [...SHIPMENT_STATUSES];

/** Token-backed colors for each status — no hex literals. */
const STATUS_FILL: Record<string, string> = {
  pickup: "var(--status-pickup)",
  warehouse: "var(--status-warehouse)",
  in_transit: "var(--status-in-transit)",
  delivered: "var(--status-delivered)",
  delayed: "var(--status-delayed)",
};

interface Props {
  data: { status: string; count: number }[];
  loading?: boolean;
  onRetry?: () => void;
}

export function DashboardShipmentStatusChart({ data, loading, onRetry }: Props) {
  const chartData = React.useMemo(() => {
    // Build from STATUS_ORDER so bars appear in lifecycle order
    return STATUS_ORDER.map((s) => {
      const found = data.find((d) => d.status === s);
      return {
        status: s,
        label: statusLabel(s),
        count: found?.count ?? 0,
      };
    });
  }, [data]);

  const hasData = chartData.some((d) => d.count > 0);

  return (
    <SectionCard title="Shipments by status">
      <ChartState
        status={loading ? "loading" : !hasData ? "empty" : "ready"}
        height={260}
        variant="bars"
        empty={{
          title: "No shipment data yet",
          description: "Create your first shipment to see status breakdown.",
        }}
        error={{ title: "Could not load chart" }}
        onRetry={onRetry}
      >
        <div className="w-full" style={{ height: 260 }}>
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
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_FILL[entry.status] ?? "var(--muted-foreground)"}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartState>
    </SectionCard>
  );
}
