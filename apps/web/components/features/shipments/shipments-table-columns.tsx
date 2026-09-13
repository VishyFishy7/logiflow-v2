"use client";

import type { ShipmentDTO } from "@logiflow/contracts";
import type { DataTableColumn } from "@/components/spectrumui/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  maskedText,
  canCopyRaw,
  dateTime,
  daysUntil,
  money,
  weight,
  truncate,
} from "@/lib/format";
import { Badge } from "@/components/spectrumui/badge";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/spectrumui/button";

/**
 * §14.3 Columns for the shipments list.
 *
 * Tracking ID (masked, copy button, pin), Client, Route (origin → destination),
 * Carrier, Status chip, Assigned to (avatar), Expected delivery (overdue marker),
 * Last update.
 */
export function shipmentsColumns({
  onCopyId,
  onReveal,
}: {
  onCopyId?: (id: string) => void;
  onReveal?: (row: ShipmentDTO) => void;
}): DataTableColumn<ShipmentDTO>[] {
  return [
    {
      id: "trackingId",
      header: "Tracking ID",
      sortable: true,
      width: 160,
      cell: (row) => {
        const display = maskedText(row.trackingId);
        const canCopy = canCopyRaw(row.trackingId);
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[13px] font-medium tabular-nums">
              {display}
            </span>
            {canCopy && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Copy tracking ID ${row.trackingId.value}`}
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(row.trackingId.raw!);
                }}
              >
                <span className="sr-only">Copy</span>
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
                  <path d="M15.565,6.686 C15.709,6.686 15.825,6.57 15.825,6.426 C15.825,4.076 14.315,2.496 12.055,2.496 L6.285,2.496 C4.025,2.496 2.505,4.076 2.505,6.426 L2.505,11.866 C2.505,14.226 4.025,15.806 6.285,15.806 L6.375,15.806 C6.541,15.806 6.675,15.672 6.675,15.506 L6.675,12.126 C6.675,8.976 8.895,6.686 11.945,6.686 L15.565,6.686 Z" />
                  <path d="M17.722,8.186 L11.949,8.186 C9.691,8.186 8.175,9.77 8.175,12.126 L8.175,17.565 C8.175,19.921 9.691,21.505 11.949,21.505 L17.721,21.505 C19.978,21.505 21.495,19.921 21.495,17.565 L21.495,12.126 C21.495,9.77 19.979,8.186 17.722,8.186 Z" />
                </svg>
              </Button>
            )}
          </div>
        );
      },
    },
    {
      id: "client",
      header: "Client",
      width: 150,
      cell: (row) => (
        <span className="text-[13px]">{truncate(row.client.name, 24)}</span>
      ),
    },
    {
      id: "route",
      header: "Route",
      width: 200,
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-[13px]">
          <span>{truncate(row.route.origin, 16)}</span>
          <ArrowRight className="size-3 text-muted-foreground" />
          <span>{truncate(row.route.destination, 16)}</span>
        </span>
      ),
    },
    {
      id: "carrier",
      header: "Carrier",
      width: 130,
      cell: (row) => (
        <span className="text-[13px]">{truncate(row.carrier.name, 18)}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      width: 140,
      cell: (row) => (
        <StatusBadge
          kind="shipment"
          value={row.status}
          delayed={row.isOverdue}
          size="sm"
        />
      ),
    },
    {
      id: "assignedTo",
      header: "Assigned",
      width: 130,
      hideBelow: "md",
      cell: (row) =>
        row.assignedTo ? (
          <span className="text-[13px]">
            {truncate(row.assignedTo.name, 18)}
          </span>
        ) : (
          <span className="text-[13px] text-muted-foreground">—</span>
        ),
    },
    {
      id: "expectedDelivery",
      header: "Expected",
      sortable: true,
      width: 110,
      hideBelow: "lg",
      cell: (row) => {
        const days = daysUntil(row.expectedDelivery);
        const isOverdue =
          days !== null && days < 0 && row.status !== "delivered";
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[13px] tabular-nums ${isOverdue ? "text-[var(--severity-error)] font-medium" : ""}`}
            >
              {dateTime(row.expectedDelivery)}
            </span>
            {isOverdue && (
              <Badge variant="destructive" className="px-1 py-0 text-[10px]">
                overdue
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "updatedAt",
      header: "Last update",
      sortable: true,
      width: 120,
      hideBelow: "lg",
      cell: (row) => (
        <span className="text-[13px] tabular-nums text-muted-foreground">
          {dateTime(row.updatedAt)}
        </span>
      ),
    },
  ];
}
