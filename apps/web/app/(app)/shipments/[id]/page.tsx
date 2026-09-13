"use client";

/**
 * §14.5 Shipment detail page.
 *
 * Two-column layout: the record on the left, the facts rail on the right.
 * Includes: Overview, Tracking IDs with reveal/copy, Timeline (StatusTracker),
 * Log status dialog, and Delete confirmation.
 */
import { useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  Copy,
  Check,
  Truck,
  Trash2,
  RefreshCw,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { CanSession } from "@/components/shared/permission-gate";
import {
  ErrorBlock,
  EmptyState,
  LoadingBlock,
} from "@/components/shared/data-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SectionCard, DetailField } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/responsive-overlay";
import { Button } from "@/components/spectrumui/button";
import { Badge } from "@/components/spectrumui/badge";

import {
  useShipment,
  useDeleteShipment,
  useRevealTracking,
  useSyncShipment,
} from "@/lib/api/queries";
import {
  maskedText,
  canCopyRaw,
  dateTime,
  relative,
  money,
  weight,
  serviceLevelLabel,
} from "@/lib/format";
import type { ShipmentStatus } from "@logiflow/contracts";

import { CheckpointLogDialog } from "@/components/features/shipments/checkpoint-log-dialog";
import { toast } from "sonner";

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
  return 0;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };
  return (
    <Button variant="ghost" size="icon-xs" aria-label={`Copy ${label}`} onClick={handleCopy}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

export default function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const query = useShipment(id);
  const deleteMut = useDeleteShipment();
  const revealMut = useRevealTracking(id);
  const syncMut = useSyncShipment(id);

  const [logOpen, setLogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const shipment = query.data;
  const isLoading = query.isPending;
  const isError = query.isError;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={shipment ? maskedText(shipment.trackingId) : "Shipment"}
        description={shipment ? `For ${shipment.client.name}` : undefined}
        back={
          <Link
            href="/shipments"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Shipments
          </Link>
        }
        actions={
          shipment && (
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                kind="shipment"
                value={shipment.status}
                delayed={shipment.isOverdue}
              />
              <CanSession permission="shipment:log_status">
                <Button variant="outline" size="sm" onClick={() => setLogOpen(true)}>
                  Log status
                </Button>
              </CanSession>
              <CanSession permission="tracking:reveal">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => revealMut.mutate()}
                  disabled={revealMut.isPending}
                >
                  <Eye className="mr-1 size-3.5" />
                  {revealMut.isPending ? "Revealing…" : "Reveal"}
                </Button>
              </CanSession>
              <CanSession permission="shipment:update">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncMut.mutate()}
                  disabled={syncMut.isPending}
                >
                  <RefreshCw className="mr-1 size-3.5" />
                  Sync
                </Button>
              </CanSession>
              <CanSession permission="shipment:delete">
                <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-1 size-3.5" />
                  Delete
                </Button>
              </CanSession>
            </div>
          )
        }
      />

      {isError && (
        <ErrorBlock
          description={query.error?.message}
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      )}

      {isLoading && <LoadingBlock rows={4} />}

      {!isLoading && !isError && !shipment && (
        <EmptyState
          title="Shipment not found"
          description="This shipment may have been deleted or you may not have access."
          action={<Button nativeButton={false} render={<Link href="/shipments" />}>Back to shipments</Button>}
        />
      )}

      {shipment && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            {/* Status tracker */}
            <SectionCard title="Progress">
              <div className="flex items-center gap-2.5">
                {STATUS_STAGES.map((stage, idx) => {
                  const activeIdx = statusToIndex(shipment.status);
                  const completed = idx < activeIdx || (shipment.status === "delivered" && idx < 4);
                  const active = idx === activeIdx && shipment.status !== "delivered";
                  return (
                    <div key={stage.id} className="flex items-center gap-2">
                      <span
                        className={`grid size-5 place-items-center rounded-full border text-xs ${
                          completed
                            ? "border-primary bg-primary text-primary-foreground"
                            : active
                              ? "border-primary text-primary"
                              : "border-border text-muted-foreground"
                        }`}
                      >
                        {completed ? <Check className="size-3" /> : idx + 1}
                      </span>
                      <span
                        className={`text-xs ${active || completed ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {stage.label}
                      </span>
                      {idx < STATUS_STAGES.length - 1 && (
                        <div className="mx-1 h-px w-6 bg-border" />
                      )}
                    </div>
                  );
                })}
              </div>
              {shipment.status === "delayed" && shipment.delayReason && (
                <p className="mt-3 text-xs text-destructive">
                  Delayed: {shipment.delayReason}
                </p>
              )}
            </SectionCard>

            {/* Route */}
            <SectionCard title="Route">
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">Origin</p>
                  <p className="text-sm font-medium mt-1">{shipment.route.origin}</p>
                  {shipment.route.originPincode && (
                    <p className="text-xs text-muted-foreground mt-0.5">{shipment.route.originPincode}</p>
                  )}
                </div>
                <Truck className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 text-center">
                  <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">Destination</p>
                  <p className="text-sm font-medium mt-1">{shipment.route.destination}</p>
                  {shipment.route.destinationPincode && (
                    <p className="text-xs text-muted-foreground mt-0.5">{shipment.route.destinationPincode}</p>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Checkpoints timeline */}
            {shipment.checkpoints && shipment.checkpoints.length > 0 && (
              <SectionCard
                title="Timeline"
                description={`${shipment.checkpoints.length} checkpoint(s) logged`}
              >
                <div className="space-y-0">
                  {shipment.checkpoints.map((cp, idx) => (
                    <div key={cp.id} className="relative flex gap-4 pb-4 last:pb-0">
                      {idx < (shipment.checkpoints?.length ?? 0) - 1 && (
                        <div className="absolute left-[7px] top-5 h-full w-px bg-border" />
                      )}
                      <div
                        className={`relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-2 ${
                          idx === 0
                            ? "border-primary bg-primary"
                            : "border-border bg-background"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <StatusBadge kind="shipment" value={cp.status} size="sm" withIcon={false} />
                          <span className="text-xs text-muted-foreground">{relative(cp.occurredAt)}</span>
                        </div>
                        <p className="text-sm mt-1">{cp.label}</p>
                        {cp.location && <p className="text-xs text-muted-foreground mt-0.5">{cp.location}</p>}
                        {cp.note && <p className="text-xs text-muted-foreground mt-0.5 italic">{cp.note}</p>}
                        {cp.delayReason && <p className="text-xs text-destructive mt-0.5">Reason: {cp.delayReason}</p>}
                        {cp.byUserName && <p className="text-[11px] text-muted-foreground mt-1">by {cp.byUserName}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>

          {/* Right rail */}
          <div className="space-y-5">
            <SectionCard title="Details">
              <dl className="space-y-4">
                <DetailField label="Client">{shipment.client.name}</DetailField>
                <DetailField label="Carrier">
                  <div className="flex items-center gap-2">
                    <span>{shipment.carrier.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{shipment.carrier.code}</Badge>
                  </div>
                </DetailField>
                <DetailField label="Service level">{serviceLevelLabel(shipment.serviceLevel)}</DetailField>
                <DetailField label="Payment mode">
                  {shipment.paymentMode === "prepaid" ? "Prepaid" : shipment.paymentMode === "cod" ? "COD" : "To pay"}
                </DetailField>
                <DetailField label="Packages">{shipment.packages}</DetailField>
                <DetailField label="Weight">{weight(shipment.weightGrams)}</DetailField>
                {shipment.declaredValuePaise != null && (
                  <DetailField label="Declared value">{money(shipment.declaredValuePaise)}</DetailField>
                )}
                {shipment.referenceNumber && <DetailField label="Reference">{shipment.referenceNumber}</DetailField>}
                {shipment.invoiceNumber && <DetailField label="Invoice #">{shipment.invoiceNumber}</DetailField>}
                <DetailField label="Assigned to">{shipment.assignedTo?.name ?? "—"}</DetailField>
                <DetailField label="Created by">{shipment.createdBy?.name ?? "—"}</DetailField>
                <DetailField label="Created">{dateTime(shipment.createdAt)}</DetailField>
                <DetailField label="Expected delivery">{dateTime(shipment.expectedDelivery)}</DetailField>
                {shipment.deliveredAt && <DetailField label="Delivered">{dateTime(shipment.deliveredAt)}</DetailField>}
                <DetailField label="Sync state">
                  <StatusBadge kind="sync" value={shipment.syncState} size="sm" />
                </DetailField>
                {shipment.notes && <DetailField label="Notes">{shipment.notes}</DetailField>}
              </dl>
            </SectionCard>

            <SectionCard title="Tracking">
              <dl className="space-y-4">
                <DetailField label="Internal tracking ID">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{maskedText(shipment.trackingId)}</span>
                    {canCopyRaw(shipment.trackingId) && (
                      <CopyButton text={shipment.trackingId.raw!} label="Tracking ID" />
                    )}
                  </div>
                </DetailField>
                <DetailField label="Carrier tracking ID">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{maskedText(shipment.carrierTrackingId)}</span>
                    {canCopyRaw(shipment.carrierTrackingId) && (
                      <CopyButton text={shipment.carrierTrackingId.raw!} label="Carrier ID" />
                    )}
                  </div>
                </DetailField>
              </dl>
            </SectionCard>

            {shipment.invoices && shipment.invoices.length > 0 && (
              <SectionCard title="Invoices" description={`${shipment.invoices.length} linked invoice(s)`}>
                <div className="space-y-2">
                  {shipment.invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                      <div>
                        <p className="text-sm font-medium">{inv.number}</p>
                        <p className="text-xs text-muted-foreground">{dateTime(inv.dueDate)}</p>
                      </div>
                      <StatusBadge kind="invoice" value={inv.status} size="sm" />
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        </div>
      )}

      {shipment && (
        <CheckpointLogDialog
          open={logOpen}
          onOpenChange={setLogOpen}
          shipmentId={shipment.id}
          currentStatus={shipment.status}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete shipment"
        description="This action cannot be undone. The shipment will be soft-deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          deleteMut.mutate(id, {
            onSuccess: () => {
              toast.success("Shipment deleted");
              router.push("/shipments");
            },
            onError: (err) => toast.error(err.message || "Failed to delete shipment"),
          });
        }}
        pending={deleteMut.isPending}
      />
    </div>
  );
}
