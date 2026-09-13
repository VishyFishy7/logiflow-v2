"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { SectionCard } from "@/components/shared/page-header";
import { ChartState, SERIES_COLORS } from "@/components/spectrumui/charts/chart-engine";

interface DelayReason {
  reason: string;
  count: number;
}

interface Props {
  data: DelayReason[];
  loading?: boolean;
  onRetry?: () => void;
}

export function AnalyticsDelayReasonsChart({ data, loading, onRetry }: Props) {
  const hasData = data.length > 0;
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <SectionCard
      title="Delay reasons breakdown"
      description="Why shipments are delayed — by frequency"
    >
      <ChartState
        status={loading ? "loading" : !hasData ? "empty" : "ready"}
        height={300}
        variant="arc"
        empty={{
          title: "No delay data yet",
          description: "Delay reason analytics will appear once shipments are marked as delayed.",
        }}
        error={{ title: "Could not load chart" }}
        onRetry={onRetry}
      >
        <div className="w-full" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="reason"
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={100}
                paddingAngle={3}
                strokeWidth={0}
                label={({ name, value }: { name?: string; value?: number }) =>
                  `${name ?? ""} (${total > 0 ? Math.round(((value ?? 0) / total) * 100) : 0}%)`
                }
                labelLine={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                    fillOpacity={0.85}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "var(--card-foreground)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Summary table */}
        {hasData && (
          <div className="mt-4 space-y-1.5">
            {data
              .sort((a, b) => b.count - a.count)
              .map((d, i) => (
                <div key={d.reason} className="flex items-center gap-3 text-[12px]">
                  <div
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                  />
                  <span className="flex-1 text-muted-foreground">{d.reason}</span>
                  <span className="font-medium tabular-nums">{d.count}</span>
                  <span className="w-10 text-right tabular-nums text-muted-foreground">
                    {total > 0 ? Math.round((d.count / total) * 100) : 0}%
                  </span>
                </div>
              ))}
          </div>
        )}
      </ChartState>
    </SectionCard>
  );
}
