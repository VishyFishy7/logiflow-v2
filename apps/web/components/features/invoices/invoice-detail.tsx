"use client";

import { useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { CanSession } from "@/components/shared/permission-gate";
import { StatusBadge } from "@/components/shared/status-badge";
import { DetailField, SectionCard } from "@/components/shared/page-header";
import { DataState, ErrorBlock } from "@/components/shared/data-state";
import { Button } from "@/components/spectrumui/button";
import { useInvoice } from "@/lib/api/queries";
import { money, date, invoiceStatusLabel, daysUntil } from "@/lib/format";
import { InvoiceFormSheet } from "./invoice-form";
import type { InvoiceDTO } from "@logiflow/contracts";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface InvoiceDetailProps {
  invoiceId: string;
}

export function InvoiceDetail({ invoiceId }: InvoiceDetailProps) {
  const [formOpen, setFormOpen] = useState(false);
  const result = useInvoice(invoiceId);

  if (result.isPending) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Loading…"
          back={
            <Link
              href="/invoices"
              className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Invoices
            </Link>
          }
        />
        <div className="animate-pulse space-y-4">
          <div className="h-48 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (result.isError || !result.data) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Invoice not found"
          back={
            <Link
              href="/invoices"
              className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Invoices
            </Link>
          }
        />
        <ErrorBlock
          description="This invoice could not be loaded."
          onRetry={() => result.refetch()}
          retrying={result.isFetching}
        />
      </div>
    );
  }

  const invoice = result.data;
  const overdue = invoice.status === "overdue" || (daysUntil(invoice.dueDate) !== null && daysUntil(invoice.dueDate)! < 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Invoice ${invoice.number}`}
        description={`${invoice.client.name} • ${invoiceStatusLabel(invoice.status)}`}
        back={
          <Link
            href="/invoices"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Invoices
          </Link>
        }
        actions={
          <CanSession permission="invoice:manage">
            <Button size="sm" onClick={() => setFormOpen(true)}>
              Edit invoice
            </Button>
          </CanSession>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <SectionCard title="Details">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <DetailField label="Amount">
                <span className="text-lg font-semibold tabular-nums">{money(invoice.totalPaise)}</span>
              </DetailField>
              <DetailField label="Status">
                <StatusBadge kind="invoice" value={invoice.status} />
              </DetailField>
              <DetailField label="Client">{invoice.client.name}</DetailField>
              <DetailField label="Issued">{date(invoice.issueDate)}</DetailField>
              <DetailField label="Due">
                <span className={overdue ? "text-[var(--severity-error)]" : ""}>
                  {date(invoice.dueDate)}
                </span>
              </DetailField>
              {invoice.paidAt && (
                <DetailField label="Paid">{date(invoice.paidAt)}</DetailField>
              )}
            </div>
          </SectionCard>

          {invoice.lines && invoice.lines.length > 0 && (
            <SectionCard title="Line items">
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 text-[12px] font-medium text-muted-foreground border-b border-border pb-2">
                  <span>Description</span>
                  <span className="text-right tabular-nums">Amount</span>
                  <span className="text-right tabular-nums">Tax</span>
                </div>
                {invoice.lines.map((line) => (
                  <div
                    key={line.id}
                    className="grid grid-cols-[1fr_auto_auto] gap-4 text-[13px] border-b border-border/50 last:border-0 py-2"
                  >
                    <span className="truncate">{line.description}</span>
                    <span className="text-right tabular-nums font-medium">{money(line.amountPaise)}</span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {(line.taxRateBp / 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        <div className="space-y-5">
          <SectionCard title="Summary">
            <div className="space-y-3">
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{money(invoice.subtotalPaise)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular-nums">{money(invoice.taxPaise)}</span>
              </div>
              <div className="flex justify-between text-[15px] font-semibold border-t border-border pt-3">
                <span>Total</span>
                <span className="tabular-nums">{money(invoice.totalPaise)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Currency</span>
                <span>{invoice.currency}</span>
              </div>
            </div>
          </SectionCard>

          {invoice.notes && (
            <SectionCard title="Notes">
              <p className="text-[13px] leading-relaxed text-muted-foreground">{invoice.notes}</p>
            </SectionCard>
          )}
        </div>
      </div>

      <InvoiceFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        invoice={invoice}
        onSuccess={() => setFormOpen(false)}
      />
    </div>
  );
}
