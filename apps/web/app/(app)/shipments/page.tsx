"use client";

/**
 * §14.3 Shipments list page.
 *
 * Full DataTable engine config per §11.3: searchable, quickFilter on status,
 * resizableColumns, keyboardNavigation, stickyHeader, selectable, bulk actions.
 * Filters are URL-backed via useListState.
 */
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Package, Filter, X } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { CanSession } from "@/components/shared/permission-gate";
import { DataState, EmptyState, ErrorBlock } from "@/components/shared/data-state";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/spectrumui/data-table";
import type { DataTableColumn } from "@/components/spectrumui/data-table";
import { Button } from "@/components/spectrumui/button";
import { Badge } from "@/components/spectrumui/badge";

import { useShipments } from "@/lib/api/queries";
import { useListState, useDebounced } from "@/lib/list-state";
import type { ShipmentDTO } from "@logiflow/contracts";
import { SHIPMENT_STATUSES, SHIPMENT_STATUS_LABELS } from "@logiflow/contracts";
import { AWAITING_CARRIER_ID, shipmentListStatusLabel } from "@/lib/format";

import { shipmentsColumns } from "@/components/features/shipments/shipments-table-columns";
import { BulkActions } from "@/components/features/shipments/bulk-actions";

/** All status options including the filter-only ones. */
const STATUS_OPTIONS = [
  "all",
  ...SHIPMENT_STATUSES,
  AWAITING_CARRIER_ID,
  "open",
] as const;

export default function ShipmentsPage() {
  const router = useRouter();
  const url = useListState({ sort: "createdAt", dir: "desc" });

  const query = useShipments({
    q: url.state.q || undefined,
    status:
      url.state.status === "all" || !url.state.status
        ? undefined
        : (url.state.status as
            | (typeof SHIPMENT_STATUSES)[number]
            | typeof AWAITING_CARRIER_ID
            | "open"),
    carrier: url.state.carrier || undefined,
    client: url.state.client || undefined,
    assignedTo: url.state.assignedTo || undefined,
    from: url.state.from || undefined,
    to: url.state.to || undefined,
    sort: url.state.sort || undefined,
    dir: url.state.dir,
    page: url.state.page,
    pageSize: url.state.pageSize,
  });

  const isLoading = query.isPending;
  const isError = query.isError;
  const data = query.data;
  const rows = data?.data ?? [];
  const isFiltered = url.activeFilterCount > 0;

  const columns = shipmentsColumns({});

  const statusForState = isLoading
    ? "pending"
    : isError
      ? "error"
      : rows.length === 0 && !isFiltered
        ? "empty"
        : rows.length === 0 && isFiltered
          ? "empty"
          : "ready";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Shipments"
        description="Every consignment in the network, with live status."
        actions={
          <CanSession permission="shipment:create">
            <Button nativeButton={false} render={<Link href="/shipments/new" />}>
              New shipment
            </Button>
          </CanSession>
        }
      />

      {query.isError && (
        <ErrorBlock
          description={query.error?.message}
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      )}

      {statusForState === "empty" && !isFiltered && (
        <EmptyState
          title="No shipments yet"
          description="Create your first shipment to start tracking consignments."
          action={
            <CanSession permission="shipment:create">
              <Button nativeButton={false} render={<Link href="/shipments/new" />}>
                New shipment
              </Button>
            </CanSession>
          }
        />
      )}

      {statusForState === "empty" && isFiltered && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <div className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Filter className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No shipments match these filters</p>
            <p className="mx-auto max-w-md text-[13px] leading-relaxed text-muted-foreground">
              Try adjusting your filters or clearing them to see all shipments.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => url.reset()}>
            <X className="mr-1 size-3" />
            Clear filters
          </Button>
        </div>
      )}

      {statusForState !== "empty" && (
        <>
          <DataTable
            data={rows}
            columns={columns}
            rowId={(row) => row.id}
            loading={isLoading}
            skeletonRows={url.state.pageSize}
            variant="default"
            density="default"
            caption="Shipments list"
            searchable
            searchPlaceholder="Search tracking ID, client, carrier…"
            defaultSort={
              url.state.sort
                ? { columnId: url.state.sort, direction: url.state.dir }
                : null
            }
            sort={
              url.state.sort
                ? { columnId: url.state.sort, direction: url.state.dir }
                : null
            }
            onSortChange={(sort) =>
              url.set({
                sort: sort?.columnId ?? "",
                dir: sort?.direction ?? "desc",
                page: 1,
              })
            }
            onRowClick={(row) => router.push(`/shipments/${row.id}`)}
            keyboardNavigation
            selectable
            bulkActions={BulkActions}
            stickyHeader
            maxHeight="70vh"
            resizableColumns
            quickFilter={{
              columnId: "status",
              label: "Filter by status",
              getValue: (row) => row.status,
              allLabel: "All",
              options: STATUS_OPTIONS.filter((s) => s !== "all").map((s) => ({
                value: s,
                label: shipmentListStatusLabel(s),
              })),
            }}
            emptyState={
              isFiltered ? (
                <div className="flex flex-col items-center gap-3 py-14">
                  <p className="text-sm text-muted-foreground">
                    No shipments match these filters
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => url.reset()}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : undefined
            }
          />

          {data && (
            <DataPagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={(page) => url.set({ page })}
              onPageSizeChange={(pageSize) =>
                url.set({ pageSize, page: 1 })
              }
            />
          )}
        </>
      )}
    </div>
  );
}
