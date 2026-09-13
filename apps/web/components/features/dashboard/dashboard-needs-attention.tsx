"use client";

import Link from "next/link";
import { AlertTriangle, Clock, PhoneCall, ArrowRight } from "lucide-react";
import type { ShipmentDTO, InvoiceDTO, LeadDTO } from "@logiflow/contracts";
import { SectionCard } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { money, relative, dateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  delayedShipments: ShipmentDTO[];
  overdueInvoices: InvoiceDTO[];
  followUpsToday: LeadDTO[];
  loading?: boolean;
}

export function DashboardNeedsAttention({
  delayedShipments,
  overdueInvoices,
  followUpsToday,
  loading,
}: Props) {
  const hasItems =
    delayedShipments.length > 0 ||
    overdueInvoices.length > 0 ||
    followUpsToday.length > 0;

  if (loading) {
    return (
      <SectionCard title="Needs attention">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (!hasItems) {
    return (
      <SectionCard title="Needs attention">
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Clock className="size-4" />
          </div>
          <p className="text-[13px] text-muted-foreground">All clear! No urgent items.</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Needs attention" description="Items requiring immediate action">
      <div className="space-y-4">
        {/* Delayed shipments */}
        {delayedShipments.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="size-3.5 text-[var(--status-delayed)]" />
              <p className="text-[12px] font-medium text-muted-foreground">
                Delayed shipments ({delayedShipments.length})
              </p>
              <Link
                href="/shipments?status=delayed"
                className="ml-auto text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                View all <ArrowRight className="inline size-3" />
              </Link>
            </div>
            <div className="space-y-1.5">
              {delayedShipments.slice(0, 5).map((shipment) => (
                <Link
                  key={shipment.id}
                  href={`/shipments/${shipment.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <StatusBadge kind="shipment" value={shipment.status} delayed size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12px]">
                      {shipment.trackingId.value}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {shipment.route.origin} → {shipment.route.destination}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {relative(shipment.expectedDelivery)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Overdue invoices */}
        {overdueInvoices.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="size-3.5 text-[var(--status-overdue)]" />
              <p className="text-[12px] font-medium text-muted-foreground">
                Overdue invoices ({overdueInvoices.length})
              </p>
              <Link
                href="/invoices?status=overdue"
                className="ml-auto text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                View all <ArrowRight className="inline size-3" />
              </Link>
            </div>
            <div className="space-y-1.5">
              {overdueInvoices.slice(0, 5).map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/invoices/${invoice.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <StatusBadge kind="invoice" value={invoice.status} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12px]">{invoice.number}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {invoice.client.name}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-medium tabular-nums">
                    {money(invoice.totalPaise)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Follow-ups today */}
        {followUpsToday.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <PhoneCall className="size-3.5 text-muted-foreground" />
              <p className="text-[12px] font-medium text-muted-foreground">
                Follow-ups today ({followUpsToday.length})
              </p>
              <Link
                href="/leads"
                className="ml-auto text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                View all <ArrowRight className="inline size-3" />
              </Link>
            </div>
            <div className="space-y-1.5">
              {followUpsToday.slice(0, 5).map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <StatusBadge kind="lead" value={lead.status} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">{lead.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {lead.company}
                    </p>
                  </div>
                  {lead.expectedValuePaise != null && (
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {money(lead.expectedValuePaise)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
