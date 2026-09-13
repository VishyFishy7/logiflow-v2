"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Can, CanSession } from "@/components/shared/permission-gate";
import { DataState, EmptyState, ErrorBlock } from "@/components/shared/data-state";
import { DataPagination } from "@/components/shared/data-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type DataTableColumn } from "@/components/spectrumui/data-table";
import { Button } from "@/components/spectrumui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/spectrumui/select";
import { useInvoices, keys } from "@/lib/api/queries";
import { invoices } from "@/lib/api/resources";
import { useListState } from "@/lib/list-state";
import { money, date, invoiceStatusLabel, daysUntil } from "@/lib/format";
import type { InvoiceDTO, InvoiceStatus, InvoiceListQuery } from "@logiflow/contracts";
import { INVOICE_STATUS_LABELS } from "@logiflow/contracts";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  ...Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

function ExportButton({ query }: { query: InvoiceListQuery }) {
  const [pending, setPending] = useState(false);

  const handleExport = async () => {
    setPending(true);
    try {
      await invoices.exportCsv(query);
      toast.success("Invoice CSV downloaded");
    } catch (error) {
      toast.error("Export failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={pending}
    >
      <Download className="size-3.5" />
      {pending ? "Exporting…" : "Export CSV"}
    </Button>
  );
}

const columns: DataTableColumn<InvoiceDTO>[] = [
  {
    id: "number",
    header: "Invoice",
    sortable: true,
    value: (row) => row.number,
    cell: (row) => (
      <span className="font-mono text-[13px] font-medium">{row.number}</span>
    ),
  },
  {
    id: "client",
    header: "Client",
    sortable: true,
    value: (row) => row.client.name,
    cell: (row) => <span className="truncate">{row.client.name}</span>,
  },
  {
    id: "totalPaise",
    header: "Amount",
    sortable: true,
    align: "end",
    numeric: true,
    value: (row) => row.totalPaise,
    cell: (row) => (
      <span className="font-semibold tabular-nums">{money(row.totalPaise)}</span>
    ),
  },
  {
    id: "status",
    header: "Status",
    sortable: true,
    value: (row) => row.status,
    cell: (row) => <StatusBadge kind="invoice" value={row.status} size="sm" />,
  },
  {
    id: "issueDate",
    header: "Issued",
    sortable: true,
    hideBelow: "md",
    value: (row) => row.issueDate,
    cell: (row) => (
      <span className="tabular-nums text-[13px]">{date(row.issueDate)}</span>
    ),
  },
  {
    id: "dueDate",
    header: "Due",
    sortable: true,
    hideBelow: "md",
    value: (row) => row.dueDate,
    cell: (row) => {
      const days = daysUntil(row.dueDate);
      const overdue = row.status === "overdue" || (days !== null && days < 0);
      return (
        <span className={`tabular-nums text-[13px] ${overdue ? "text-[var(--severity-error)]" : ""}`}>
          {date(row.dueDate)}
        </span>
      );
    },
  },
  {
    id: "isOverdue",
    header: "Overdue",
    hideBelow: "lg",
    value: (row) => (row.isOverdue ? "Yes" : "No"),
    cell: (row) =>
      row.isOverdue ? (
        <span className="text-[var(--severity-error)] text-[12px] font-medium">Yes</span>
      ) : (
        <span className="text-muted-foreground text-[12px]">No</span>
      ),
  },
];

export default function InvoicesPage() {
  const url = useListState({
    q: "",
    status: "all",
    page: 1,
    pageSize: 25,
  });

  const query: InvoiceListQuery = {
    q: url.state.q || undefined,
    status: url.state.status === "all" ? undefined : (url.state.status as InvoiceStatus),
    page: Number(url.state.page) || 1,
    pageSize: Number(url.state.pageSize) || 25,
    sort: url.state.sort || undefined,
    dir: url.state.dir || "desc",
  };

  const result = useInvoices(query);

  const status = result.isPending
    ? "pending"
    : result.isError
      ? "error"
      : (result.data?.data ?? []).length === 0 && url.state.q
        ? "empty"
        : (result.data?.data ?? []).length === 0
          ? "empty"
          : "ready";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Invoices"
        description="Billing, payment status and GST for every client."
        actions={
          <CanSession permission="invoice:read">
            <ExportButton query={query} />
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
            skeletonRows={url.state.pageSize}
          />
        }
        empty={
          url.state.q ? (
            <EmptyState
              title="No invoices match your search"
              description="Try clearing the search or changing the status filter."
            />
          ) : (
            <EmptyState
              title="No invoices yet"
              description="Invoices are created when you bill a client for shipments."
            />
          )
        }
        error={
          <ErrorBlock
            description="We couldn't load the invoices list. Please try again."
            onRetry={() => result.refetch()}
            retrying={result.isFetching}
          />
        }
      >
        <DataTable
          data={result.data?.data ?? []}
          columns={columns}
          rowId={(row) => row.id}
          rowLabel={(row) => `Invoice ${row.number}`}
          caption="Invoices for all clients, with payment status."
          variant="bordered"
          density="compact"
          loading={result.isPending}
          skeletonRows={url.state.pageSize}
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
          totals={["totalPaise"]}
          keyboardNavigation
          className="w-full"
        />
      </DataState>

      <DataPagination
        page={result.data?.page ?? 1}
        pageSize={result.data?.pageSize ?? url.state.pageSize}
        total={result.data?.total ?? 0}
        totalPages={result.data?.totalPages ?? 1}
        onPageChange={(page) => url.set({ page })}
        onPageSizeChange={(pageSize) => url.set({ pageSize, page: 1 })}
      />
    </div>
  );
}
