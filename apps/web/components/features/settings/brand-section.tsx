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
 * §14.11 Brand settings — company name, product name, tagline, tracking
 * prefix, support email. Saving through `useUpdateSettings('brand')` which
 * invalidates both settings and session (so the sidebar product name updates
 * live).
 */
export function BrandSection() {
  const { data: tenant } = useSettings();
  const update = useUpdateSettings("brand");
  const [form, setForm] = useState(() => ({
    companyName: "",
    productName: "",
    tagline: "",
    trackingPrefix: "",
    supportEmail: "",
  }));
  const [initialized, setInitialized] = useState(false);

  // Initialize form from fetched data once
  if (tenant && !initialized) {
    setForm({
      companyName: tenant.companyName,
      productName: tenant.productName,
      tagline: tenant.tagline,
      trackingPrefix: tenant.trackingPrefix,
      supportEmail: tenant.supportEmail,
    });
    setInitialized(true);
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(form, {
      onSuccess: () => {
        toast.success("Brand settings saved");
      },
      onError: (err) => {
        toast.error(err?.message || "Failed to save brand settings");
      },
    });
  };

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <form onSubmit={handleSubmit}>
      <SectionCard title="Brand" description="White-label settings for your organisation.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="brand-company">Company name</Label>
            <Input
              id="brand-company"
              value={form.companyName}
              onChange={(e) => set("companyName", e.target.value)}
              placeholder="Five Logistics"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-product">Product name</Label>
            <Input
              id="brand-product"
              value={form.productName}
              onChange={(e) => set("productName", e.target.value)}
              placeholder="LogiFlow"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-tagline">Tagline</Label>
            <Input
              id="brand-tagline"
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="Logistics, simplified"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-prefix">Tracking prefix</Label>
            <Input
              id="brand-prefix"
              value={form.trackingPrefix}
              onChange={(e) => set("trackingPrefix", e.target.value.toUpperCase())}
              placeholder="5LX"
              className="font-mono"
              maxLength={5}
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="brand-email">Support email</Label>
            <Input
              id="brand-email"
              type="email"
              value={form.supportEmail}
              onChange={(e) => set("supportEmail", e.target.value)}
              placeholder="support@fivelogistics.in"
              required
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <LoadingButton type="submit" loading={update.isPending}>
            <Save className="size-4" />
            Save brand
          </LoadingButton>
        </div>
      </SectionCard>
    </form>
  );
}
