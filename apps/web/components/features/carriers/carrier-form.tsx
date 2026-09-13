"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  ResponsiveOverlay,
} from "@/components/shared/responsive-overlay";
import { LoadingButton } from "@/components/spectrumui/loading-button-dependencies";
import { Input } from "@/components/spectrumui/input";
import { Label } from "@/components/spectrumui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/spectrumui/select";
import { Switch } from "@/components/spectrumui/switch";
import { useSaveCarrier } from "@/lib/api/queries";
import { errorMessage } from "@/lib/api/client";
import type { Carrier, CarrierCreateInput, CarrierAdapterCode, CarrierCode } from "@logiflow/contracts";
import { CARRIER_CODES, CARRIER_NAMES, CARRIER_ADAPTERS } from "@logiflow/contracts";

interface CarrierFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrier: Carrier | null;
  onSuccess: () => void;
}

export function CarrierFormSheet({
  open,
  onOpenChange,
  carrier,
  onSuccess,
}: CarrierFormSheetProps) {
  const saveCarrier = useSaveCarrier();
  const isEditing = Boolean(carrier);

  const [code, setCode] = useState<CarrierCode>((carrier?.code ?? "DTDC") as CarrierCode);
  const [name, setName] = useState(carrier?.name ?? "");
  const [adapter, setAdapter] = useState<CarrierAdapterCode>((carrier?.adapter ?? "mock") as CarrierAdapterCode);
  const [trackingUrlTemplate, setTrackingUrlTemplate] = useState(carrier?.trackingUrlTemplate ?? "");
  const [supportsWebhook, setSupportsWebhook] = useState(carrier?.supportsWebhook ?? false);
  const [active, setActive] = useState(carrier?.active ?? true);
  const [priority, setPriority] = useState(carrier?.priority ?? 50);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (open) {
      setCode((carrier?.code ?? "DTDC") as CarrierCode);
      setName(carrier?.name ?? "");
      setAdapter((carrier?.adapter ?? "mock") as CarrierAdapterCode);
      setTrackingUrlTemplate(carrier?.trackingUrlTemplate ?? "");
      setSupportsWebhook(carrier?.supportsWebhook ?? false);
      setActive(carrier?.active ?? true);
      setPriority(carrier?.priority ?? 50);
      setNameError(false);
    }
  }, [open, carrier]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    try {
      const input: CarrierCreateInput = {
        code,
        name: name.trim(),
        adapter,
        trackingUrlTemplate: trackingUrlTemplate || null,
        supportsWebhook,
        active,
        priority,
      };
      await saveCarrier.mutateAsync(
        isEditing ? { id: carrier!.id, input } : { input },
      );
      toast.success(isEditing ? `Carrier ${name} updated` : `Carrier ${name} added`);
      onSuccess();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? `Edit ${carrier?.name}` : "Add carrier"}
      description="Configure a carrier adapter and its settings."
      footer={
        <>
          <button
            type="button"
            className="rounded-md px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-muted transition-colors"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <LoadingButton
            onClick={onSubmit}
            loading={saveCarrier.isPending}
            disabled={saveCarrier.isPending}
          >
            {isEditing ? "Save changes" : "Add carrier"}
          </LoadingButton>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="carrier-code">Carrier</Label>
          <Select value={code} onValueChange={(v) => v && setCode(v as CarrierCode)}>
            <SelectTrigger id="carrier-code">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CARRIER_CODES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CARRIER_NAMES[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="carrier-name">Display name</Label>
          <Input
            id="carrier-name"
            placeholder="e.g. DTDC Express"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={nameError}
          />
          {nameError && (
            <p className="text-[var(--severity-error)] text-[12px]">Name is required</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="carrier-adapter">Adapter</Label>
          <Select
            value={adapter}
            onValueChange={(v) => v && setAdapter(v as CarrierAdapterCode)}
          >
            <SelectTrigger id="carrier-adapter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CARRIER_ADAPTERS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="carrier-tracking-url">Tracking URL template</Label>
          <Input
            id="carrier-tracking-url"
            placeholder="https://example.com/track/{trackingId}"
            value={trackingUrlTemplate}
            onChange={(e) => setTrackingUrlTemplate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="carrier-priority">Priority</Label>
          <Input
            id="carrier-priority"
            type="number"
            min={0}
            max={100}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value) || 0)}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="carrier-webhook">Webhook support</Label>
            <p className="text-[12px] text-muted-foreground">
              Enable if the carrier sends status updates via webhook.
            </p>
          </div>
          <Switch
            id="carrier-webhook"
            checked={supportsWebhook}
            onCheckedChange={setSupportsWebhook}
          />
        </div>
      </form>
    </ResponsiveOverlay>
  );
}
