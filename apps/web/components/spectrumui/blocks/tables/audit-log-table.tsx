'use client';

import * as React from 'react';
import { DataTable, type DataTableColumn, type DataTableSort } from '@/components/spectrumui/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import type { AuditEventDTO } from '@logiflow/contracts';
import { auditTime } from '@/lib/format';
import { cn } from '@/lib/utils';

// ── Diff / metadata rendering ──────────────────────────────────────────────

type AuditChanges = Record<string, { from?: unknown; to?: unknown }> | null | undefined;

function DiffValue({ label, from, to }: { label: string; from: unknown; to: unknown }) {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <span className="shrink-0 text-muted-foreground font-medium min-w-[60px]">{label}</span>
      <span className="text-[var(--severity-error)] line-through decoration-1">
        {String(from ?? '—')}
      </span>
      <span aria-hidden className="text-muted-foreground">→</span>
      <span className="text-[var(--severity-info)]">{String(to ?? '—')}</span>
    </div>
  );
}

function ChangesSummary({ changes }: { changes: AuditChanges }) {
  if (!changes || typeof changes !== 'object') return null;
  const entries = Object.entries(changes).slice(0, 3);
  const remaining = Object.keys(changes).length - entries.length;
  return (
    <div className="mt-1.5 space-y-0.5">
      {entries.map(([field, { from, to }]) => (
        <DiffValue key={field} label={field} from={from} to={to} />
      ))}
      {remaining > 0 && (
        <span className="text-[11px] text-muted-foreground">
          +{remaining} more {remaining === 1 ? 'field' : 'fields'}
        </span>
      )}
    </div>
  );
}

// ── Severity display ───────────────────────────────────────────────────────

type Level = 'info' | 'warn' | 'error';

const LEVEL_STYLE: Record<Level, string> = {
  info: 'text-neutral-500 dark:text-neutral-400',
  warn: 'text-amber-700 dark:text-amber-300',
  error: 'text-rose-700 dark:text-rose-300',
};

// ── Actor display ──────────────────────────────────────────────────────────

function ActorCell({ event }: { event: AuditEventDTO }) {
  return (
    <span className="flex items-center gap-2 font-normal">
      {event.actorAvatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={event.actorAvatarUrl}
          alt=""
          loading="lazy"
          width={20}
          height={20}
          className="size-5 shrink-0 rounded-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-5 shrink-0 place-items-center rounded-full bg-neutral-100 font-mono text-[9px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
        >
          {'>_'}
        </span>
      )}
      <span className="truncate">{event.actorName}</span>
    </span>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface AuditLogTableProps {
  events: AuditEventDTO[];
  loading?: boolean;
  /** Pinned variant renders with sticky header and a max height; Paged is standard. */
  variant?: 'Pinned' | 'Paged';
  /** Rows per page for the Paged variant. */
  pageSize?: number;
  /** External sort state (from URL) */
  sort?: DataTableSort;
  /** External sort change handler */
  onSortChange?: (sort: DataTableSort | null) => void;
  className?: string;
}

// ── Columns ────────────────────────────────────────────────────────────────

function buildColumns(): DataTableColumn<AuditEventDTO>[] {
  return [
    {
      id: 'occurredAt',
      header: 'Time',
      sortable: true,
      value: (row) => row.occurredAt,
      cell: (row) => (
        <span className="tabular-nums text-[13px]">{auditTime(row.occurredAt)}</span>
      ),
    },
    {
      id: 'actorName',
      header: 'Actor',
      sortable: true,
      value: (row) => row.actorName,
      cell: (_row, _index) => <ActorCell event={_row} />,
    },
    {
      id: 'action',
      header: 'Action',
      sortable: true,
      value: (row) => row.action,
      cell: (row) => (
        <div>
          <span className="font-mono text-xs">{row.action}</span>
          {row.summary && (
            <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">{row.summary}</p>
          )}
          <ChangesSummary changes={row.changes} />
        </div>
      ),
    },
    {
      id: 'entityLabel',
      header: 'Target',
      hideBelow: 'lg',
      value: (row) => row.entityLabel,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="truncate text-[13px]">{row.entityLabel}</span>
          <span className="text-[11px] text-muted-foreground font-mono">{row.entityType}</span>
        </div>
      ),
    },
    {
      id: 'ip',
      header: 'IP',
      hideBelow: 'md',
      value: (row) => row.ip ?? '',
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.ip ?? '—'}</span>
      ),
    },
    {
      id: 'severity',
      header: 'Level',
      sortable: true,
      value: (row) => row.severity,
      cell: (row) => (
        <StatusBadge kind="severity" value={row.severity} size="sm" />
      ),
    },
  ];
}

// ── Component ──────────────────────────────────────────────────────────────

export function AuditLogTable({
  events,
  loading = false,
  variant = 'Paged',
  pageSize = 8,
  sort: sortProp,
  onSortChange,
  className,
}: AuditLogTableProps) {
  const pinned = variant === 'Pinned';
  const columns = React.useMemo(() => buildColumns(), []);

  return (
    <div className={cn('w-full', className)}>
      <DataTable
        data={events}
        columns={columns}
        rowId={(row) => row.id}
        rowLabel={(row) => `${row.action} — ${row.entityLabel}`}
        caption="Audit events, newest first."
        variant="bordered"
        density="compact"
        loading={loading}
        skeletonRows={pageSize}
        resizableColumns
        pinFirstColumn
        stickyHeader={pinned}
        maxHeight={pinned ? 340 : undefined}
        pageSize={pinned ? undefined : pageSize}
        defaultSort={{ columnId: 'occurredAt', direction: 'desc' }}
        sort={sortProp}
        onSortChange={onSortChange}
        keyboardNavigation
      />
    </div>
  );
}
