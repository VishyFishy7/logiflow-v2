"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, FileJson } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { CanSession } from "@/components/shared/permission-gate";
import { DataState, EmptyState, ErrorBlock } from "@/components/shared/data-state";
import { DataPagination } from "@/components/shared/data-pagination";
import { Button } from "@/components/spectrumui/button";
import { AuditLogTable } from "@/components/spectrumui/blocks/tables/audit-log-table";
import { AuditFilters } from "@/components/features/audit/audit-filters";
import { useAuditLog } from "@/lib/api/queries";
import { audit } from "@/lib/api/resources";
import { useListState } from "@/lib/list-state";
import type { AuditListQuery } from "@logiflow/contracts";

function ExportButtons({ query }: { query: AuditListQuery }) {
  const [csvPending, setCsvPending] = useState(false);
  const [jsonlPending, setJsonlPending] = useState(false);

  const handleCsvExport = async () => {
    setCsvPending(true);
    try {
      await audit.exportCsv(query);
      toast.success("Audit CSV downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setCsvPending(false);
    }
  };

  const handleJsonlExport = async () => {
    setJsonlPending(true);
    try {
      await audit.exportJsonl(query);
      toast.success("Audit JSONL downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setJsonlPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCsvExport}
        disabled={csvPending || jsonlPending}
      >
        <Download className="size-3.5" />
        {csvPending ? "Exporting…" : "CSV"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleJsonlExport}
        disabled={csvPending || jsonlPending}
      >
        <FileJson className="size-3.5" />
        {jsonlPending ? "Exporting…" : "JSONL"}
      </Button>
    </div>
  );
}

export default function AuditPage() {
  const url = useListState({
    q: "",
    status: "all",
    severity: "all",
    entityType: "all",
    page: 1,
    pageSize: 25,
  });

  const query: AuditListQuery = {
    q: url.state.q || undefined,
    severity: url.state.severity === "all" ? undefined : (url.state.severity as "info" | "warn" | "error"),
    entityType: url.state.entityType === "all" ? undefined : (url.state.entityType as string),
    page: Number(url.state.page) || 1,
    pageSize: Number(url.state.pageSize) || 25,
    sort: url.state.sort || undefined,
    dir: url.state.dir || "desc",
  };

  const result = useAuditLog(query);

  const status = result.isPending
    ? "pending"
    : result.isError
      ? "error"
      : (result.data?.data ?? []).length === 0 && (url.state.q || url.state.severity !== "all" || url.state.entityType !== "all")
        ? "empty"
        : (result.data?.data ?? []).length === 0
          ? "empty"
          : "ready";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Audit log"
        description="Every privileged action, append-only."
        actions={
          <CanSession permission="audit:export">
            <ExportButtons query={query} />
          </CanSession>
        }
      />

      <DataState
        status={status}
        skeleton={
          <AuditLogTable
            events={[]}
            loading
            variant="Paged"
            pageSize={url.state.pageSize}
          />
        }
        empty={
          url.state.q || url.state.severity !== "all" || url.state.entityType !== "all" ? (
            <EmptyState
              title="No events match your filters"
              description="Try broadening or clearing the filters above."
            />
          ) : (
            <EmptyState
              title="No audit events yet"
              description="Actions like status changes, invoice edits and team updates appear here."
            />
          )
        }
        error={
          <ErrorBlock
            description="We couldn't load the audit log. Please try again."
            onRetry={() => result.refetch()}
            retrying={result.isFetching}
          />
        }
      >
        <AuditFilters
          severity={url.state.severity as string}
          entityType={url.state.entityType as string}
          onSeverityChange={(severity) => url.setFilter({ severity, page: 1 })}
          onEntityTypeChange={(entityType) => url.setFilter({ entityType, page: 1 })}
        />
        <AuditLogTable
          events={result.data?.data ?? []}
          loading={result.isPending}
          variant="Paged"
          pageSize={url.state.pageSize}
          sort={
            url.state.sort
              ? { columnId: url.state.sort, direction: url.state.dir }
              : undefined
          }
          onSortChange={(sort) =>
            url.set({
              sort: sort?.columnId ?? "",
              dir: sort?.direction ?? "desc",
              page: 1,
            })
          }
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
