"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { CanSession } from "@/components/shared/permission-gate";
import { DataState, EmptyState, ErrorBlock } from "@/components/shared/data-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type DataTableColumn } from "@/components/spectrumui/data-table";
import { Button } from "@/components/spectrumui/button";
import { useCarriers, useSaveCarrier, useRotateCarrierSecret } from "@/lib/api/queries";
import { CarrierFormSheet } from "@/components/features/carriers/carrier-form";
import type { Carrier } from "@logiflow/contracts";
import { CARRIER_NAMES } from "@logiflow/contracts";
import { date } from "@/lib/format";

const columns: DataTableColumn<Carrier>[] = [
  {
    id: "name",
    header: "Carrier",
    sortable: true,
    value: (row) => row.name,
    cell: (row) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.name}</span>
        <span className="text-muted-foreground text-[12px]">{CARRIER_NAMES[row.code]}</span>
      </div>
    ),
  },
  {
    id: "code",
    header: "Code",
    sortable: true,
    value: (row) => row.code,
    cell: (row) => (
      <span className="font-mono text-[13px]">{row.code}</span>
    ),
  },
  {
    id: "adapter",
    header: "Adapter",
    hideBelow: "md",
    value: (row) => row.adapter,
    cell: (row) => (
      <span className="font-mono text-[12px] text-muted-foreground">{row.adapter}</span>
    ),
  },
  {
    id: "active",
    header: "Status",
    value: (row) => (row.active ? "active" : "inactive"),
    cell: (row) => (
      <StatusBadge
        kind="severity"
        value={row.active ? "info" : "warn"}
        size="sm"
        withIcon={false}
      />
    ),
  },
  {
    id: "supportsWebhook",
    header: "Webhook",
    hideBelow: "lg",
    value: (row) => (row.supportsWebhook ? "Yes" : "No"),
    cell: (row) =>
      row.supportsWebhook ? (
        <span className="text-[var(--severity-info)] text-[12px]">Yes</span>
      ) : (
        <span className="text-muted-foreground text-[12px]">No</span>
      ),
  },
  {
    id: "openShipments",
    header: "Open",
    hideBelow: "md",
    align: "end",
    numeric: true,
    value: (row) => row.openShipments ?? 0,
    cell: (row) => (
      <span className="tabular-nums">{row.openShipments ?? 0}</span>
    ),
  },
  {
    id: "priority",
    header: "Priority",
    hideBelow: "lg",
    align: "end",
    numeric: true,
    value: (row) => row.priority,
    cell: (row) => (
      <span className="tabular-nums text-[13px]">{row.priority}</span>
    ),
  },
  {
    id: "createdAt",
    header: "Added",
    hideBelow: "lg",
    sortable: true,
    value: (row) => row.createdAt,
    cell: (row) => (
      <span className="tabular-nums text-[13px] text-muted-foreground">{date(row.createdAt)}</span>
    ),
  },
];

export default function CarriersPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);

  const result = useCarriers();
  const saveCarrier = useSaveCarrier();
  const rotateSecret = useRotateCarrierSecret();

  const status = result.isPending
    ? "pending"
    : result.isError
      ? "error"
      : (result.data?.data ?? []).length === 0
        ? "empty"
        : "ready";

  const handleRotateSecret = async (carrier: Carrier) => {
    try {
      await rotateSecret.mutateAsync(carrier.id);
      toast.success(`Webhook secret rotated for ${carrier.name}`);
    } catch {
      toast.error("Failed to rotate secret");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Carriers"
        description="Carrier adapters, priorities and webhook secrets."
        actions={
          <CanSession permission="carrier:manage">
            <Button size="sm" onClick={() => { setEditingCarrier(null); setFormOpen(true); }}>
              <Plus className="size-3.5" />
              Add carrier
            </Button>
          </CanSession>
        }
      />

      <DataState
        status={status}
        skeleton={
          <DataTable
            data={[]}
            columns={columns}
            rowId={() => ""}
            loading
            skeletonRows={10}
          />
        }
        empty={
          <EmptyState
            title="No carriers configured"
            description="Add a carrier to start booking shipments through their adapter."
          />
        }
        error={
          <ErrorBlock
            description="We couldn't load the carriers list. Please try again."
            onRetry={() => result.refetch()}
            retrying={result.isFetching}
          />
        }
      >
        <DataTable
          data={result.data?.data ?? []}
          columns={columns}
          rowId={(row) => row.id}
          rowLabel={(row) => row.name}
          caption="Configured carriers and their adapter status."
          variant="bordered"
          density="compact"
          loading={result.isPending}
          skeletonRows={10}
          onRowClick={(row) => {
            setEditingCarrier(row);
            setFormOpen(true);
          }}
          rowActions={(row) => (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Rotate secret for ${row.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRotateSecret(row);
                }}
              >
                <RefreshCw className="size-3.5" />
              </Button>
            </div>
          )}
          keyboardNavigation
          className="w-full"
        />
      </DataState>

      <CarrierFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        carrier={editingCarrier}
        onSuccess={() => {
          setFormOpen(false);
          setEditingCarrier(null);
        }}
      />
    </div>
  );
}
