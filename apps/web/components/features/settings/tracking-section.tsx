"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { Button } from "@/components/spectrumui/button";
import { LoadingButton } from "@/components/spectrumui/loading-button-dependencies";
import { Input } from "@/components/spectrumui/input";
import { Label } from "@/components/spectrumui/label";
import { SectionCard } from "@/components/shared/page-header";
import { useSettings, useUpdateSettings } from "@/lib/api/queries";

/**
 * §14.11 Tracking settings — tracking prefix, mask policy, public tracking
 * toggle. Uses `useUpdateSettings('tracking')`.
 */
export function TrackingSection() {
  const { data: tenant } = useSettings();
  const update = useUpdateSettings("tracking");
  const [form, setForm] = useState(() => ({
    trackingPrefix: "",
    maskPolicy: "last2" as "last2" | "first2_last2" | "full" | "none",
    publicTrackingEnabled: true,
  }));
  const [initialized, setInitialized] = useState(false);

  if (tenant && !initialized) {
    setForm({
      trackingPrefix: tenant.trackingPrefix,
      maskPolicy: tenant.maskPolicy,
      publicTrackingEnabled: tenant.publicTrackingEnabled,
    });
    setInitialized(true);
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(form, {
      onSuccess: () => toast.success("Tracking settings saved"),
      onError: (err) => toast.error(err?.message || "Failed to save tracking settings"),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <SectionCard
        title="Tracking"
        description="Control how tracking IDs are displayed and who can access them."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="track-prefix">Tracking prefix</Label>
            <Input
              id="track-prefix"
              value={form.trackingPrefix}
              onChange={(e) =>
                setForm((p) => ({ ...p, trackingPrefix: e.target.value.toUpperCase() }))
              }
              placeholder="5LX"
              className="font-mono"
              maxLength={5}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="track-mask">Mask policy</Label>
            <select
              id="track-mask"
              value={form.maskPolicy}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  maskPolicy: e.target.value as typeof form.maskPolicy,
                }))
              }
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              <option value="last2">Last 2 visible (default)</option>
              <option value="first2_last2">First 2 + Last 2</option>
              <option value="full">Fully masked</option>
              <option value="none">No masking (reveal only)</option>
            </select>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="button"
              role="switch"
              aria-checked={form.publicTrackingEnabled}
              onClick={() =>
                setForm((p) => ({ ...p, publicTrackingEnabled: !p.publicTrackingEnabled }))
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ${
                form.publicTrackingEnabled ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                className={`pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  form.publicTrackingEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <Label className="cursor-pointer" onClick={() => setForm((p) => ({ ...p, publicTrackingEnabled: !p.publicTrackingEnabled }))}>
              Enable public tracking page
            </Label>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <LoadingButton type="submit" loading={update.isPending}>
            <Save className="size-4" />
            Save tracking
          </LoadingButton>
        </div>
      </SectionCard>
    </form>
  );
}
