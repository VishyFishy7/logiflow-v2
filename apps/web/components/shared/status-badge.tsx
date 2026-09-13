"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudOff,
  Handshake,
  Loader2,
  Package,
  PhoneCall,
  RefreshCw,
  Sparkles,
  Trophy,
  Truck,
  Warehouse,
  XCircle,
} from "lucide-react";

import {
  AWAITING_CARRIER_ID,
  invoiceStatusLabel,
  invoiceTone,
  leadStatusLabel,
  leadTone,
  shipmentListStatusLabel,
  shipmentTone,
  syncStateLabel,
  severityTone,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The one status pill used anywhere a state is shown (§12.4). Shape is shared
 * across every kind so a shipment row, a lead card and an invoice row read as
 * the same product; only the token pair changes.
 *
 * Colours are never literals here — they come from the `--status-*`,
 * `--severity-*` tokens in globals.css via `lib/format.ts`.
 */
export type StatusKind = "shipment" | "lead" | "invoice" | "severity" | "sync";

export interface StatusBadgeProps {
  kind: StatusKind;
  value: string;
  /** §8.4 — a delayed shipment overrides its stage colour. */
  delayed?: boolean;
  size?: "sm" | "md";
  withIcon?: boolean;
  className?: string;
}

const SHIPMENT_ICON: Record<string, typeof Package> = {
  pickup: Package,
  warehouse: Warehouse,
  in_transit: Truck,
  delivered: CheckCircle2,
  delayed: AlertTriangle,
  [AWAITING_CARRIER_ID]: Clock,
};

const LEAD_ICON: Record<string, typeof Sparkles> = {
  new: Sparkles,
  contacted: PhoneCall,
  negotiation: Handshake,
  won: Trophy,
  lost: XCircle,
};

const INVOICE_ICON: Record<string, typeof Clock> = {
  paid: CheckCircle2,
  pending: Clock,
  overdue: AlertCircle,
};

const SYNC_ICON: Record<string, typeof CloudOff> = {
  synced: CheckCircle2,
  pending: Clock,
  failed: AlertCircle,
  offline: CloudOff,
};

const SEVERITY_ICON: Record<string, typeof AlertTriangle> = {
  info: CheckCircle2,
  warn: AlertTriangle,
  error: AlertCircle,
};

export function StatusBadge({
  kind,
  value,
  delayed,
  size = "md",
  withIcon = true,
  className,
}: StatusBadgeProps) {
  const tone =
    kind === "shipment"
      ? shipmentTone(value, delayed)
      : kind === "lead"
        ? leadTone(value as never)
        : kind === "invoice"
          ? invoiceTone(value as never)
          : kind === "severity"
            ? severityTone(value as never)
            : "bg-muted text-muted-foreground";

  const label =
    kind === "shipment"
      ? shipmentListStatusLabel(value)
      : kind === "lead"
        ? leadStatusLabel(value as never)
        : kind === "invoice"
          ? invoiceStatusLabel(value as never)
          : kind === "sync"
            ? syncStateLabel(value as never)
            : value;

  const Icon =
    kind === "shipment"
      ? SHIPMENT_ICON[value]
      : kind === "lead"
        ? LEAD_ICON[value]
        : kind === "invoice"
          ? INVOICE_ICON[value]
          : kind === "sync"
            ? SYNC_ICON[value]
            : SEVERITY_ICON[value];

  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-[background-color,color] duration-150",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        tone,
        className,
      )}
    >
      {withIcon &&
        (kind === "sync" && value === "pending" ? (
          <Loader2 className="size-3 shrink-0 animate-spin motion-reduce:animate-none" />
        ) : kind === "sync" && value === "failed" ? (
          <RefreshCw className="size-3 shrink-0" />
        ) : Icon ? (
          <Icon className="size-3 shrink-0" />
        ) : null)}
      {label}
    </span>
  );
}
