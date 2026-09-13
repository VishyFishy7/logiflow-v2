"use client";

import { PageHeader } from "@/components/shared/page-header";
import { CanSession } from "@/components/shared/permission-gate";
import { DataState } from "@/components/shared/data-state";
import { useSettings } from "@/lib/api/queries";
import { BrandSection } from "@/components/features/settings/brand-section";
import { TrackingSection } from "@/components/features/settings/tracking-section";
import { VocabularySection } from "@/components/features/settings/vocabulary-section";
import { TenantSection } from "@/components/features/settings/tenant-section";

/**
 * §14.11 Settings page. Sections are gated by `settings:manage`. The brand
 * section update invalidates the session query so `tenant.productName` is
 * live-updated in the sidebar (see `useUpdateSettings` in queries.ts).
 */
export default function SettingsPage() {
  const { data, isPending, isError, error, refetch } = useSettings();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Settings"
        description="Configure your organisation's branding, tracking and vocabulary."
      />

      <CanSession permission="settings:manage">
        <DataState
          status={isPending ? "pending" : isError ? "error" : data ? "ready" : "empty"}
          skeleton={
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          }
          error={
            <p className="text-sm text-muted-foreground">
              Could not load settings.{" "}
              <button onClick={() => refetch()} className="underline hover:text-foreground">
                Retry
              </button>
            </p>
          }
          empty={<p className="text-sm text-muted-foreground">No settings found.</p>}
        >
          <div className="space-y-6">
            <BrandSection />
            <TrackingSection />
            <VocabularySection />
            <TenantSection />
          </div>
        </DataState>
      </CanSession>
    </div>
  );
}
