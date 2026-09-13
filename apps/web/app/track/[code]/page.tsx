"use client";

import { useState, type FormEvent } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { Package, Search, Clock, Truck, CheckCircle2, AlertTriangle, Warehouse } from "lucide-react";

import { Button } from "@/components/spectrumui/button";
import { LoadingButton } from "@/components/spectrumui/loading-button-dependencies";
import { Input } from "@/components/spectrumui/input";
import { SectionCard } from "@/components/shared/page-header";
import { DataState, ErrorBlock } from "@/components/shared/data-state";
import { useTrackingLookup } from "@/lib/api/queries";
import { SHIPMENT_STATUS_LABELS } from "@logiflow/contracts";
import { SHIPMENT_STATUS_ORDER } from "@logiflow/contracts";
import { date, dateTime, weight } from "@/lib/format";
import type { PublicTrackingResponse, ShipmentStatus } from "@logiflow/contracts";

const STATUS_ICON: Record<ShipmentStatus, typeof Package> = {
  pickup: Package,
  warehouse: Warehouse,
  in_transit: Truck,
  delivered: CheckCircle2,
  delayed: AlertTriangle,
};

/**
 * §14.12 Public tracking page — unauthenticated, mobile-first. Uses
 * `useTrackingLookup`. Carrier tracking ID is masked (never raw). The
 * tracking ID is echoed as entered (visitor already has it).
 */
export default function TrackPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [inputValue, setInputValue] = useState(code);
  const decodedCode = decodeURIComponent(code);

  const { data, isPending, isError, error, refetch } = useTrackingLookup(
    decodedCode || undefined,
    { retry: false },
  );

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed) {
      router.push(`/track/${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      {/* Minimal shell — brand mark + search */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-xl bg-primary/10">
              <Package className="size-4 text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Track shipment</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* Search form */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter tracking ID (e.g. 5LX-DT58K7)"
              className="font-mono text-[13px]"
              aria-label="Tracking ID"
            />
            <LoadingButton type="submit" loading={isPending}>
              <Search className="size-4" />
              Track
            </LoadingButton>
          </div>
        </form>

        {/* Result */}
        <DataState
          status={isPending ? "pending" : isError ? "error" : data ? "ready" : decodedCode ? "empty" : "empty"}
          skeleton={<TrackingSkeleton />}
          error={
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <AlertTriangle className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="text-sm font-medium">We couldn&apos;t find that consignment</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Please check the tracking ID and try again.
              </p>
            </div>
          }
          empty={
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <Search className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                Enter a tracking ID to see shipment status
              </p>
            </div>
          }
        >
          {data && <TrackingResult data={data} />}
        </DataState>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-8">
        <div className="mx-auto max-w-2xl px-4 py-4 text-center text-[12px] text-muted-foreground">
          {data?.brand.productName ?? "LogiFlow"} · {data?.brand.companyName ?? ""}
          {data?.brand.supportEmail ? (
            <> · <a href={`mailto:${data.brand.supportEmail}`} className="underline hover:text-foreground">{data.brand.supportEmail}</a></>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

function TrackingResult({ data }: { data: PublicTrackingResponse }) {
  const statusOrder = [...SHIPMENT_STATUS_ORDER, "delayed"] as const;
  const activeIndex = statusOrder.indexOf(data.status);

  return (
    <div className="space-y-5">
      {/* Current status banner */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-3">
          <StatusDot status={data.status} />
          <div>
            <p className="text-lg font-semibold tracking-[-0.01em]">
              {SHIPMENT_STATUS_LABELS[data.status]}
            </p>
            <p className="text-[13px] text-muted-foreground">
              Tracking ID: <span className="font-mono font-medium">{data.trackingId}</span>
            </p>
          </div>
        </div>

        {/* Route */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{data.route.origin}</span>
          <Truck className="size-3.5" />
          <span>{data.route.destination}</span>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoCard label="Service" value={data.serviceLevel} />
        <InfoCard label="Packages" value={String(data.packages)} />
        <InfoCard label="Weight" value={weight(data.weightGrams)} />
        <InfoCard
          label="Expected delivery"
          value={date(data.expectedDelivery)}
        />
      </div>

      {data.delayReason && (
        <div className="rounded-xl border border-[var(--status-delayed)]/25 bg-[var(--status-delayed-bg)] px-4 py-3 text-[13px]">
          <span className="font-medium text-[var(--status-delayed)]">Delay reason: </span>
          <span className="text-muted-foreground">{data.delayReason}</span>
        </div>
      )}

      {/* Timeline */}
      {data.checkpoints.length > 0 && (
        <SectionCard title="Timeline" description="Shipment checkpoint history.">
          <div className="space-y-0">
            {data.checkpoints.map((cp, idx) => {
              const Icon = STATUS_ICON[cp.status] ?? Package;
              const isLatest = idx === data.checkpoints.length - 1;
              return (
                <div key={idx} className="flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div
                      className={`grid size-8 place-items-center rounded-full ${
                        isLatest
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                    </div>
                    {idx < data.checkpoints.length - 1 && (
                      <div className="mt-1 h-full min-h-[20px] w-px bg-border" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="text-sm font-medium">{cp.label}</p>
                    {cp.location && (
                      <p className="text-[13px] text-muted-foreground">{cp.location}</p>
                    )}
                    <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                      {dateTime(cp.occurredAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Last updated */}
      <p className="text-center text-[12px] text-muted-foreground">
        Last updated {dateTime(data.lastUpdatedAt)}
      </p>
    </div>
  );
}

function StatusDot({ status }: { status: ShipmentStatus }) {
  const tones: Record<ShipmentStatus, string> = {
    pickup: "bg-[var(--status-pickup)]",
    warehouse: "bg-[var(--status-warehouse)]",
    in_transit: "bg-[var(--status-in-transit)]",
    delivered: "bg-[var(--status-delivered)]",
    delayed: "bg-[var(--status-delayed)]",
  };

  return (
    <span
      className={`inline-block size-2.5 shrink-0 rounded-full ${tones[status]}`}
      aria-hidden
    />
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function TrackingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-28 rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-48 rounded-2xl bg-muted" />
    </div>
  );
}
