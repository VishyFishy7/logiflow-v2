'use client';

/**
 * Lead card rendered inside the kanban board.
 * Shows: name, company, source, expected value, follow-up date, assignee.
 */
import { Calendar, User2 } from 'lucide-react';
import type { LeadDTO } from '@logiflow/contracts';

import { Badge } from '@/components/spectrumui/badge';
import { money } from '@/lib/format';
import { date } from '@/lib/format';
import { StatusBadge } from '@/components/shared/status-badge';

export function LeadCard({
  lead,
  onOpen,
}: {
  lead: LeadDTO;
  onOpen?: () => void;
}) {
  return (
    <div
      className="space-y-1.5 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium leading-tight line-clamp-1">
          {lead.name}
        </p>
        <StatusBadge kind="lead" size="sm" value={lead.status} withIcon={false} />
      </div>
      <p className="text-[12px] text-muted-foreground line-clamp-1">
        {lead.company}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {lead.expectedValuePaise != null && lead.expectedValuePaise > 0 && (
          <span className="tabular-nums font-medium text-foreground">
            {money(lead.expectedValuePaise)}
          </span>
        )}
        <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
          {lead.source}
        </Badge>
        {lead.nextFollowUp && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3" />
            {date(lead.nextFollowUp)}
          </span>
        )}
      </div>
      {lead.assignedTo && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <User2 className="size-3" />
          <span className="truncate">{lead.assignedTo.name}</span>
        </div>
      )}
    </div>
  );
}
