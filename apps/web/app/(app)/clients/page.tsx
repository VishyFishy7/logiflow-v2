'use client';

/**
 * Clients list page (PRD §14.11 / §6.1 — Client entity).
 *
 * Server-paged DataTable with search, detail overlay via ?client=<id>,
 * new client overlay via ?new=1. Matches the command palette links.
 */
import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Plus } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { CanSession, useCan } from '@/components/shared/permission-gate';
import { DataState, EmptyState, ErrorBlock } from '@/components/shared/data-state';
import { ResponsiveOverlay } from '@/components/shared/responsive-overlay';
import { Button } from '@/components/spectrumui/button';
import { DataTable, type DataTableColumn } from '@/components/spectrumui/data-table';
import { DataPagination } from '@/components/shared/data-pagination';
import { ClientForm, type ClientFormValues } from '@/components/features/clients/client-form';
import { ClientDetail } from '@/components/features/clients/client-detail';
import { useClients, useCreateClient } from '@/lib/api/queries';
import { useListState } from '@/lib/list-state';
import { money, dateTime } from '@/lib/format';
import { errorMessage } from '@/lib/api/client';
import { toast } from 'sonner';
import type { ClientDTO } from '@logiflow/contracts';

// ── Table columns ──────────────────────────────────────────────────────────

const TABLE_COLUMNS: DataTableColumn<ClientDTO>[] = [
  {
    id: 'name',
    header: 'Client',
    cell: (client) => (
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Building2 className="size-4" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-[13px] font-medium truncate">{client.name}</p>
          {client.contactName && (
            <p className="text-[12px] text-muted-foreground truncate">{client.contactName}</p>
          )}
        </div>
      </div>
    ),
    sortable: true,
  },
  {
    id: 'city',
    header: 'City',
    cell: (client) => (
      <span className="text-[13px] text-muted-foreground">
        {client.city ?? '—'}
      </span>
    ),
    hideBelow: 'md',
  },
  {
    id: 'shipmentCount',
    header: 'Shipments',
    cell: (client) => (
      <span className="text-[13px] tabular-nums">
        {client.shipmentCount ?? 0}
      </span>
    ),
    align: 'end',
    numeric: true,
    hideBelow: 'lg',
  },
  {
    id: 'outstandingPaise',
    header: 'Outstanding',
    cell: (client) => (
      <span className="text-[13px] tabular-nums font-medium">
        {money(client.outstandingPaise)}
      </span>
    ),
    align: 'end',
    numeric: true,
  },
  {
    id: 'active',
    header: 'Status',
    cell: (client) => (
      <span
        className={
          client.active
            ? 'text-[12px] text-[var(--status-won)]'
            : 'text-[12px] text-muted-foreground'
        }
      >
        {client.active ? 'Active' : 'Inactive'}
      </span>
    ),
    hideBelow: 'md',
  },
];

// ── Page component ─────────────────────────────────────────────────────────

export default function ClientsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canManage = useCan('client:manage');

  const clientDetailId = searchParams.get('client');
  const isNewOpen = searchParams.get('new') === '1';

  const url = useListState({ page: 1, pageSize: 25 });

  const clientsQuery: {
    q?: string;
    page?: number;
    pageSize?: number;
  } = {
    q: url.state.q || undefined,
    page: Number(url.state.page),
    pageSize: Number(url.state.pageSize),
  };

  const query = useClients(clientsQuery as Parameters<typeof useClients>[0]);

  const createClient = useCreateClient();

  const clients = query.data?.data ?? [];
  const isLoading = query.isPending;
  const isError = query.isError;
  const isEmpty = !isLoading && clients.length === 0;
  const isFilteredEmpty = !isLoading && clients.length === 0 && !!url.state.q;

  // ── URL helpers ───────────────────────────────────────────────────────
  function openClient(clientId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('client', clientId);
    router.push(`/clients?${params.toString()}`, { scroll: false });
  }

  function openNew() {
    const params = new URLSearchParams(searchParams.toString());
    params.set('new', '1');
    router.push(`/clients?${params.toString()}`, { scroll: false });
  }

  function closeOverlay() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('client');
    params.delete('new');
    const qs = params.toString();
    router.replace(qs ? `/clients?${qs}` : '/clients', { scroll: false });
  }

  // ── Create handler ────────────────────────────────────────────────────
  function handleCreate(values: ClientFormValues) {
    createClient.mutate(
      {
        name: values.name,
        contactName: values.contactName || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
        pincode: values.pincode || undefined,
        addressLine1: values.addressLine1 || undefined,
        addressLine2: values.addressLine2 || undefined,
        gstin: values.gstin || undefined,
        creditTermsDays: values.creditTermsDays ? parseInt(values.creditTermsDays, 10) : undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Client ${values.name} created`);
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
        title="Clients"
        description="Manage your customer accounts, contacts and outstanding balances."
        actions={
          <div className="flex items-center gap-2">
            <CanSession permission="client:manage">
              <Button onClick={openNew}>
                <Plus className="size-4 mr-1" />
                New client
              </Button>
            </CanSession>
          </div>
        }
      />

      <DataState
        status={dataStatus}
        skeleton={
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        }
        empty={
          isFilteredEmpty ? (
            <EmptyState
              title="No clients match your search"
              description="Try a different search term or clear the filter."
              action={
                <Button variant="outline" onClick={() => url.reset()}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No clients yet"
              description="Add your first client to start tracking shipments and invoices."
              icon={Building2}
              action={
                canManage ? (
                  <Button onClick={openNew}>
                    <Plus className="size-4 mr-1" />
                    New client
                  </Button>
                ) : undefined
              }
            />
          )
        }
        error={<ErrorBlock onRetry={() => query.refetch()} retrying={query.isRefetching} />}
      >
        <div className="rounded-2xl border border-border bg-card">
          <DataTable
            data={clients}
            columns={TABLE_COLUMNS}
            rowId={(row) => row.id}
            loading={isLoading}
            skeletonRows={url.state.pageSize}
            searchable
            searchPlaceholder="Search clients by name, city, contact…"
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
            onRowClick={(row) => openClient(row.id)}
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
        </div>
      </DataState>

      {/* Client detail overlay — opened via ?client=<id> */}
      {clientDetailId && <ClientDetail clientId={clientDetailId} />}

      {/* New client overlay — opened via ?new=1 */}
      {isNewOpen && (
        <ResponsiveOverlay
          open
          onOpenChange={(open) => {
            if (!open) closeOverlay();
          }}
          title="New client"
          description="Add a new customer account."
        >
          <ClientForm
            onSubmit={handleCreate}
            submitting={createClient.isPending}
          />
        </ResponsiveOverlay>
      )}
    </div>
  );
}
