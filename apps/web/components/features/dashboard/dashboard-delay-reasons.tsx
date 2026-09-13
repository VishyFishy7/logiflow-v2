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

export function DashboardDelayReasons({ data, loading, onRetry }: Props) {
  const hasData = data.length > 0;

  return (
    <SectionCard title="Delay reasons" description="Why shipments are delayed">
      <ChartState
        status={loading ? "loading" : !hasData ? "empty" : "ready"}
        height={260}
        variant="arc"
        empty={{
          title: "No delays yet",
          description: "Delay reasons will appear when shipments are marked as delayed.",
        }}
        error={{ title: "Could not load chart" }}
        onRetry={onRetry}
      >
        <div className="w-full" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="reason"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                strokeWidth={0}
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
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartState>
    </SectionCard>
  );
}
