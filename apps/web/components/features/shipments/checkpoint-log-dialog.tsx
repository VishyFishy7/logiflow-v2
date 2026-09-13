"use client";

/**
 * §14.5 Log status checkpoint dialog.
 *
 * Opens a ResponsiveOverlay with the status stepper, location, note,
 * occurred_at picker, and a mandatory delay reason when "delayed" is chosen.
 */
import { useState } from "react";
import type { ShipmentStatus } from "@logiflow/contracts";
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  DELAY_REASONS,
} from "@logiflow/contracts";
import { ResponsiveOverlay } from "@/components/shared/responsive-overlay";
import { Button } from "@/components/spectrumui/button";
import { Input } from "@/components/spectrumui/input";
import { Label } from "@/components/spectrumui/label";
import { LoadingButton } from "@/components/spectrumui/loading-button-dependencies";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/spectrumui/select";
import { StatusTracker } from "@/components/spectrumui/blocks/ai-assistants/status-tracker";
import { toast } from "sonner";
import { useLogCheckpoint } from "@/lib/api/queries";

const STATUS_STAGES = [
  { id: "pickup", label: "Pickup" },
  { id: "warehouse", label: "Warehouse" },
  { id: "in_transit", label: "In Transit" },
  { id: "delivered", label: "Delivered" },
];

function statusToIndex(status: ShipmentStatus): number {
  if (status === "delivered") return 3;
  if (status === "in_transit") return 2;
  if (status === "warehouse") return 1;
  if (status === "pickup") return 0;
  // delayed or other
  return 0;
}

export function CheckpointLogDialog({
  open,
  onOpenChange,
  shipmentId,
  currentStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentId: string;
  currentStatus: ShipmentStatus;
}) {
  const logCheckpoint = useLogCheckpoint(shipmentId);

  const [status, setStatus] = useState<ShipmentStatus>(currentStatus);
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [delayReason, setDelayReason] = useState<string>("");
  const [label, setLabel] = useState("");

  const isDelayed = status === "delayed";

  const handleSubmit = () => {
    if (isDelayed && !delayReason) {
      toast.error("A delay reason is required when status is delayed");
      return;
    }

    logCheckpoint.mutate(
      {
        status,
        location: location || undefined,
        note: note || undefined,
        label: label || undefined,
        delayReason: isDelayed ? delayReason : undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            `Status updated to ${SHIPMENT_STATUS_LABELS[status]}`,
          );
          onOpenChange(false);
          // Reset
          setStatus(currentStatus);
          setLocation("");
          setNote("");
          setDelayReason("");
          setLabel("");
        },
        onError: (error) => {
          toast.error(error.message || "Failed to log checkpoint");
        },
      },
    );
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Log status"
      description="Update the shipment status and add checkpoint details."
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton
            loading={logCheckpoint.isPending}
            onClick={handleSubmit}
          >
            Log checkpoint
          </LoadingButton>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Status tracker visual */}
        <StatusTracker
          stages={STATUS_STAGES}
          activeIndex={statusToIndex(status)}
          variant="Minimal"
        />

        {/* Status select */}
        <div className="space-y-1.5">
          <Label>Status *</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as ShipmentStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHIPMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SHIPMENT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Delay reason (only when delayed) */}
        {isDelayed && (
          <div className="space-y-1.5">
            <Label>Delay reason *</Label>
            <Select value={delayReason} onValueChange={(v) => setDelayReason(v ?? "")}>
              <SelectTrigger aria-invalid={!delayReason}>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {DELAY_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!delayReason && (
              <p className="text-xs text-destructive">
                Delay reason is required
              </p>
            )}
          </div>
        )}

        {/* Label */}
        <div className="space-y-1.5">
          <Label htmlFor="cp-label">Label</Label>
          <Input
            id="cp-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Picked up from origin"
          />
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <Label htmlFor="cp-location">Location</Label>
          <Input
            id="cp-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Mumbai warehouse"
          />
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <Label htmlFor="cp-note">Note</Label>
          <textarea
            id="cp-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note about this checkpoint..."
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none resize-none"
          />
        </div>
      </div>
    </ResponsiveOverlay>
  );
}
