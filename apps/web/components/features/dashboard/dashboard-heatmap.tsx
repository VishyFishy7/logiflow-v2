"use client";

import * as React from "react";
import { SectionCard } from "@/components/shared/page-header";
import { ChartState } from "@/components/spectrumui/charts/chart-engine";
import { cn } from "@/lib/utils";

interface HeatmapPoint {
  date: string;
  count: number;
}

interface Props {
  data: HeatmapPoint[];
  loading?: boolean;
  onRetry?: () => void;
}

function buildWeeks(data: HeatmapPoint[]): { date: string; count: number; weekday: number; week: number }[] {
  if (data.length === 0) return [];
  // Sort by date
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const first = new Date(sorted[0].date + "T00:00:00");
  const firstDay = first.getDay(); // 0=Sun
  return sorted.map((d) => {
    const dt = new Date(d.date + "T00:00:00");
    const diffDays = Math.round((dt.getTime() - first.getTime()) / 86_400_000);
    return {
      ...d,
      weekday: dt.getDay(),
      week: Math.floor((diffDays + firstDay) / 7),
    };
  });
}

const CELL_SIZE = 14;
const CELL_GAP = 3;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function intensity(count: number, max: number): string {
  if (max === 0 || count === 0) return "var(--muted)";
  const t = count / max;
  return `color-mix(in srgb, var(--spectrum-series-1) ${(t * 80).toFixed(0)}%, var(--muted))`;
}

export function DashboardHeatmap({ data, loading, onRetry }: Props) {
  const weeks = React.useMemo(() => buildWeeks(data), [data]);
  const maxCount = React.useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);

  const hasData = data.length > 0;
  const totalWeeks = weeks.length > 0 ? Math.max(...weeks.map((w) => w.week)) + 1 : 0;
  const gridWidth = totalWeeks * (CELL_SIZE + CELL_GAP);
  const gridHeight = 7 * (CELL_SIZE + CELL_GAP);

  return (
    <SectionCard title="Activity heatmap" description="Shipment creation activity by day">
      <ChartState
        status={loading ? "loading" : !hasData ? "empty" : "ready"}
        height={140}
        variant="grid"
        empty={{
          title: "No activity data yet",
          description: "A heatmap will appear once shipments start being created.",
        }}
        error={{ title: "Could not load heatmap" }}
        onRetry={onRetry}
      >
        <div className="overflow-x-auto">
          <svg
            width={gridWidth}
            height={gridHeight + 16}
            viewBox={`0 0 ${gridWidth} ${gridHeight + 16}`}
            aria-label="Shipment activity heatmap"
            role="img"
          >
            {weeks.map((w) => (
              <rect
                key={w.date}
                x={w.week * (CELL_SIZE + CELL_GAP)}
                y={w.weekday * (CELL_SIZE + CELL_GAP)}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={3}
                fill={intensity(w.count, maxCount)}
              >
                <title>{`${w.date}: ${w.count} shipment${w.count !== 1 ? "s" : ""}`}</title>
              </rect>
            ))}
          </svg>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <div
              key={t}
              className="size-3.5 rounded-sm"
              style={{ background: intensity(t * maxCount, maxCount) }}
            />
          ))}
          <span>More</span>
        </div>
      </ChartState>
    </SectionCard>
  );
}
