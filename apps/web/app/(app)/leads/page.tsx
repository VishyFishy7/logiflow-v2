'use client';

/**
 * Leads pipeline page (PRD §14.7).
 *
 * Default view: kanban board with five columns (new → contacted → negotiation
 * → won/lost). Table view toggle for comparison. Detail overlay via ?lead=<id>,
 * new lead overlay via ?new=1. Both URL params match the command palette links.
 *
 * Kanban columns show leads grouped by status. Moving a lead between columns
 * persists via useSaveLead and writes lead.status_changed to the audit log.
 */
import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, List, Plus, Target } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { CanSession, useCan } from '@/components/shared/permission-gate';
import { DataState, EmptyState, ErrorBlock } from '@/components/shared/data-state';
import { ResponsiveOverlay } from '@/components/shared/responsive-overlay';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/spectrumui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/spectrumui/tabs';
import { KanbanBoard, groupBy, type KanbanColumn } from '@/components/spectrumui/kanbanboard';
import { DataTable, type DataTableColumn } from '@/components/spectrumui/data-table';
import { DataPagination } from '@/components/shared/data-pagination';
import { LeadCard } from '@/components/features/leads/lead-card';
import { LeadDetail } from '@/components/features/leads/lead-detail';
import { LeadForm, type LeadFormValues } from '@/components/features/leads/lead-form';
import { useLeads, useSaveLead } from '@/lib/api/queries';
import { useListState } from '@/lib/list-state';
import { money, date } from '@/lib/format';
import { errorMessage } from '@/lib/api/client';
import { toast } from 'sonner';
import {
  LEAD_STATUS_LABELS,
  type LeadDTO,
  type LeadStatus,
} from '@logiflow/contracts';

// ── Kanban column config ───────────────────────────────────────────────────

const KANBAN_COLUMNS: { id: LeadStatus; color: string }[] = [
  { id: 'new', color: 'var(--status-new)' },
  { id: 'contacted', color: 'var(--status-contacted)' },
  { id: 'negotiation', color: 'var(--status-negotiation)' },
  { id: 'won', color: 'var(--status-won)' },
  { id: 'lost', color: 'var(--status-lost)' },
];

// ── Table columns ──────────────────────────────────────────────────────────

const TABLE_COLUMNS: DataTableColumn<LeadDTO>[] = [
  {
    id: 'name',
    header: 'Name',
    cell: (lead) => (
      <div className="space-y-0.5">
        <p className="text-[13px] font-medium">{lead.name}</p>
        <p className="text-[12px] text-muted-foreground">{lead.company}</p>
      </div>
    ),
    sortable: true,
  },
  {
    id: 'source',
    header: 'Source',
    cell: (lead) => <span className="text-[13px] text-muted-foreground">{lead.source}</span>,
    hideBelow: 'md',
  },
  {
    id: 'status',
    header: 'Status',
    cell: (lead) => <StatusBadge kind="lead" size="sm" value={lead.status} />,
    sortable: true,
  },
  {
    id: 'expectedValuePaise',
    header: 'Value',
    cell: (lead) => (
      <span className="tabular-nums text-[13px]">{money(lead.expectedValuePaise)}</span>
    ),
    align: 'end',
    numeric: true,
    sortable: true,
  },
  {
    id: 'nextFollowUp',
    header: 'Follow-up',
    cell: (lead) => (
      <span className="text-[13px] text-muted-foreground tabular-nums">
        {date(lead.nextFollowUp)}
      </span>
    ),
    hideBelow: 'lg',
    sortable: true,
  },
  {
    id: 'assignedTo',
    header: 'Assigned',
    cell: (lead) => (
      <span className="text-[13px] text-muted-foreground">
        {lead.assignedTo?.name ?? '—'}
      </span>
    ),
    hideBelow: 'md',
  },
];

// ── Page component ─────────────────────────────────────────────────────────

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canManage = useCan('lead:manage');

  const leadDetailId = searchParams.get('lead');
  const isNewOpen = searchParams.get('new') === '1';

  const url = useListState({ page: 1, pageSize: 25 });

  const leadsQuery: {
    q?: string;
    status?: string;
    page?: number;
    pageSize?: number;
    sort?: string;
    dir?: 'asc' | 'desc';
  } = {
    q: url.state.q || undefined,
    status: url.state.status === 'all' || !url.state.status ? undefined : url.state.status,
    page: Number(url.state.page),
    pageSize: Number(url.state.pageSize),
    sort: url.state.sort || undefined,
    dir: (url.state.dir as 'asc' | 'desc') || undefined,
  };

  const query = useLeads(leadsQuery as Parameters<typeof useLeads>[0]);

  const saveLead = useSaveLead();

  const leads = query.data?.data ?? [];
  const isLoading = query.isPending;
  const isError = query.isError;
  const isEmpty = !isLoading && leads.length === 0;
  const isFilteredEmpty = !isLoading && leads.length === 0 && url.state.status !== 'all';

  // ── Kanban grouping ───────────────────────────────────────────────────
  const leadsByStatus = useMemo(() => {
    const map = groupBy(leads, (lead) => lead.status);
    return map;
  }, [leads]);

  const kanbanColumns: KanbanColumn<LeadDTO>[] = useMemo(
    () =>
      KANBAN_COLUMNS.map((col) => ({
        id: col.id,
        title: LEAD_STATUS_LABELS[col.id],
        items: leadsByStatus.get(col.id) ?? [],
        color: col.color,
      })),
    [leadsByStatus],
  );

  // ── Kanban move handler ───────────────────────────────────────────────
  const handleKanbanMove = useCallback(
    (leadId: string, toStatus: string) => {
      saveLead.mutate(
        { id: leadId, input: { status: toStatus as LeadStatus } },
        {
          onSuccess: () => {
            toast.success(`Lead moved to ${LEAD_STATUS_LABELS[toStatus as LeadStatus]}`);
          },
          onError: (err) => toast.error(errorMessage(err)),
        },
      );
    },
    [saveLead],
  );

  const moveLabelMap = useMemo(
    () =>
      Object.fromEntries(KANBAN_COLUMNS.map((col) => [col.id, LEAD_STATUS_LABELS[col.id]])),
    [],
  );

  // ── URL helpers ───────────────────────────────────────────────────────
  function openLead(leadId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('lead', leadId);
    router.push(`/leads?${params.toString()}`, { scroll: false });
  }

  function openNew() {
    const params = new URLSearchParams(searchParams.toString());
    params.set('new', '1');
    router.push(`/leads?${params.toString()}`, { scroll: false });
  }

  function closeOverlay() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('lead');
    params.delete('new');
    const qs = params.toString();
    router.replace(qs ? `/leads?${qs}` : '/leads', { scroll: false });
  }

  // ── Create handler ────────────────────────────────────────────────────
  function handleCreate(values: LeadFormValues) {
    saveLead.mutate(
      {
        input: {
          name: values.name,
          company: values.company,
          email: values.email || undefined,
          phone: values.phone || undefined,
          source: values.source as never,
          notes: values.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Lead ${values.name} created`);
          closeOverlay();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  // ── Status for DataState ──────────────────────────────────────────────
  const dataStatus = isLoading ? 'pending' : isError ? 'error' : isEmpty ? 'empty' : 'ready';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Leads"
        description="Track prospects through the sales pipeline."
        actions={
          <div className="flex items-center gap-2">
            <CanSession permission="lead:manage">
              <Button onClick={openNew}>
                <Plus className="size-4 mr-1" />
                New lead
              </Button>
            </CanSession>
          </div>
        }
      />

      <DataState
        status={dataStatus}
        skeleton={
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 w-24 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
            <div className="h-[400px] animate-pulse rounded-2xl bg-muted/50" />
          </div>
        }
        empty={
          isFilteredEmpty ? (
            <EmptyState
              title="No leads match these filters"
              description="Try adjusting your filters or create a new lead."
              action={
                <Button variant="outline" onClick={() => url.reset()}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No leads yet"
              description="Create your first lead to start tracking prospects."
              icon={Target}
              action={
                canManage ? (
                  <Button onClick={openNew}>
                    <Plus className="size-4 mr-1" />
                    New lead
                  </Button>
                ) : undefined
              }
            />
          )
        }
        error={<ErrorBlock onRetry={() => query.refetch()} retrying={query.isRefetching} />}
      >
        <Tabs defaultValue="kanban" className="space-y-4">
          <TabsList>
            <TabsTrigger value="kanban" className="gap-1.5">
              <LayoutGrid className="size-3.5" />
              Board
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-1.5">
              <List className="size-3.5" />
              Table
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kanban">
            <KanbanBoard
              columns={kanbanColumns}
              renderCard={(lead, { onMove }) => (
                <LeadCard lead={lead} onOpen={() => openLead(lead.id)} />
              )}
              onMove={handleKanbanMove}
              moveLabelMap={moveLabelMap}
              loading={isLoading}
              emptyState="No leads"
            />
          </TabsContent>

          <TabsContent value="table" className="space-y-0">
            <DataTable
              data={leads}
              columns={TABLE_COLUMNS}
              rowId={(row) => row.id}
              loading={isLoading}
              skeletonRows={url.state.pageSize}
              searchable
              searchPlaceholder="Search leads by name, company…"
              sort={
                url.state.sort
                  ? { columnId: url.state.sort, direction: url.state.dir as 'asc' | 'desc' }
                  : null
              }
              onSortChange={(sort) =>
                url.set({
                  sort: sort?.columnId ?? '',
                  dir: sort?.direction ?? 'desc',
                  page: 1,
                })
              }
              onRowClick={(row) => openLead(row.id)}
              keyboardNavigation
              stickyHeader
              maxHeight="65vh"
            />
            <DataPagination
              page={query.data?.page ?? 1}
              pageSize={query.data?.pageSize ?? url.state.pageSize}
              total={query.data?.total ?? 0}
              totalPages={query.data?.totalPages ?? 1}
              onPageChange={(page) => url.set({ page })}
              onPageSizeChange={(pageSize) => url.set({ pageSize, page: 1 })}
            />
          </TabsContent>
        </Tabs>
      </DataState>

      {/* Lead detail overlay — opened via ?lead=<id> */}
      {leadDetailId && <LeadDetail leadId={leadDetailId} />}

      {/* New lead overlay — opened via ?new=1 */}
      {isNewOpen && (
        <ResponsiveOverlay
          open
          onOpenChange={(open) => {
            if (!open) closeOverlay();
          }}
          title="New lead"
          description="Add a prospect to the pipeline."
        >
          <LeadForm onSubmit={handleCreate} submitting={saveLead.isPending} />
        </ResponsiveOverlay>
      )}
    </div>
  );
}
