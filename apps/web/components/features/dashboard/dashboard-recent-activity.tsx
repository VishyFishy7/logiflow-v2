"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AuditEventDTO } from "@logiflow/contracts";
import { SectionCard } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingBlock } from "@/components/shared/data-state";
import { auditTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  events: AuditEventDTO[];
  loading?: boolean;
  total?: number;
}

function ActorAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
      {initials || ">_"}
    </div>
  );
}

export function DashboardRecentActivity({ events, loading, total }: Props) {
  return (
    <SectionCard
      title="Recent activity"
      description="Latest audit events across the workspace"
      actions={
        <Link
          href="/audit"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View all
          <ArrowRight className="size-3" />
        </Link>
      }
    >
      {loading ? (
        <LoadingBlock rows={5} />
      ) : events.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          No recent activity.
        </p>
      ) : (
        <div className="space-y-0">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 border-b border-border/50 py-2.5 last:border-0"
            >
              <ActorAvatar name={event.actorName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">
                  <span className="font-medium">{event.actorName}</span>{" "}
                  <span className="text-muted-foreground">{event.summary}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {auditTime(event.occurredAt)}
                </p>
              </div>
              <StatusBadge kind="severity" value={event.severity} size="sm" />
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
