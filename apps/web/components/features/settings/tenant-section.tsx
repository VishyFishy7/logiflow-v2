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
 * §14.11 Tenant settings — timezone, currency, slug. Uses
 * `useUpdateSettings('tenant')`.
 */
export function TenantSection() {
  const { data: tenant } = useSettings();
  const update = useUpdateSettings("tenant");
  const [form, setForm] = useState(() => ({
    slug: "",
    timezone: "",
    currency: "",
  }));
  const [initialized, setInitialized] = useState(false);

  if (tenant && !initialized) {
    setForm({
      slug: tenant.slug,
      timezone: tenant.timezone,
      currency: tenant.currency,
    });
    setInitialized(true);
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(form, {
      onSuccess: () => toast.success("Tenant settings saved"),
      onError: (err) => toast.error(err?.message || "Failed to save tenant settings"),
    });
  };

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <form onSubmit={handleSubmit}>
      <SectionCard
        title="Tenant"
        description="Organisation-wide settings."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tenant-slug">Tenant slug</Label>
            <Input
              id="tenant-slug"
              value={form.slug}
              onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="five-logistics"
              className="font-mono"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tenant-tz">Timezone</Label>
            <Input
              id="tenant-tz"
              value={form.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              placeholder="Asia/Kolkata"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tenant-currency">Currency</Label>
            <Input
              id="tenant-currency"
              value={form.currency}
              onChange={(e) => set("currency", e.target.value.toUpperCase())}
              placeholder="INR"
              className="font-mono"
              maxLength={3}
              required
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <LoadingButton type="submit" loading={update.isPending}>
            <Save className="size-4" />
            Save tenant
          </LoadingButton>
        </div>
      </SectionCard>
    </form>
  );
}
