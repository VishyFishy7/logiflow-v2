import {
  asMaskedValue,
  maskSecret,
  CARRIER_ID_POLICY,
  INTERNAL_ID_POLICY,
  type MaskPolicy,
} from "@logiflow/shared";
import type {
  AuditEventDTO,
  Carrier,
  CheckpointDTO,
  ClientDTO,
  InvoiceDTO,
  LeadActivityDTO,
  LeadActivityKind,
  LeadDTO,
  MaskedValueDTO,
  NotificationDTO,
  ShipmentDTO,
  ShipmentStatus,
  SyncState,
} from "@logiflow/contracts";
import type {
  auditEvents,
  carriers,
  checkpoints,
  clients,
  invoices,
  leadActivities,
  leads,
  notifications,
  shipments,
} from "./schema/index.js";

/**
 * Masking envelope. When the viewer holds `tracking:reveal` the raw value is
 * included and `masked` is false; everybody else gets the display string only,
 * so the raw ID is never in the payload to begin with (PRD §8.3).
 */
export function envelope(raw: string | null | undefined, policy: MaskPolicy, reveal: boolean): MaskedValueDTO {
  if (raw === null || raw === undefined || raw === "") {
    return { value: "—", masked: false, policy };
  }
  if (reveal) return { value: raw, raw, masked: false, policy };
  return { value: maskSecret(raw, policy), masked: true, policy };
}

export const internalIdEnvelope = (raw: string | null | undefined, reveal: boolean) =>
  envelope(raw, INTERNAL_ID_POLICY, reveal);

export const carrierIdEnvelope = (raw: string | null | undefined, reveal: boolean) =>
  envelope(raw, CARRIER_ID_POLICY, reveal);

/** Kept for parity with code that needs the display string only. */
export const displayOnly = (raw: string | null | undefined, policy: MaskPolicy) =>
  asMaskedValue(raw, policy).value;

type ShipmentRow = typeof shipments.$inferSelect;
type CheckpointRow = typeof checkpoints.$inferSelect;
type ClientRow = typeof clients.$inferSelect;
type CarrierRow = typeof carriers.$inferSelect;
type LeadRow = typeof leads.$inferSelect;
type LeadActivityRow = typeof leadActivities.$inferSelect;
type InvoiceRow = typeof invoices.$inferSelect;
type NotificationRow = typeof notifications.$inferSelect;
type AuditRow = typeof auditEvents.$inferSelect;

export interface ShipmentSideData {
  clientName: string;
  clientId: string;
  carrierId: string;
  carrierCode: string;
  carrierName: string;
  assignedName?: string | null;
  assignedEmail?: string | null;
  assignedAvatar?: string | null;
  createdByName?: string | null;
  checkpointCount?: number;
  invoiceCount?: number;
}

export function dateOnlyMs(value: number): number {
  return value;
}

export function rowToShipment(
  row: ShipmentRow,
  side: ShipmentSideData,
  options: { reveal: boolean; now?: number },
): ShipmentDTO {
  const now = options.now ?? Date.now();
  return {
    id: row.id,
    tenantId: row.tenantId,
    trackingId: internalIdEnvelope(row.trackingId, options.reveal),
    carrierTrackingId: carrierIdEnvelope(row.carrierTrackingId, options.reveal),
    carrierTrackingIdSetAt: row.carrierTrackingIdSetAt ?? null,
    client: { id: side.clientId, name: side.clientName },
    carrier: { id: side.carrierId, code: side.carrierCode as Carrier["code"], name: side.carrierName },
    route: {
      origin: row.origin,
      destination: row.destination,
      originPincode: row.originPincode ?? null,
      destinationPincode: row.destinationPincode ?? null,
    },
    referenceNumber: row.referenceNumber ?? null,
    invoiceNumber: row.invoiceNumber ?? null,
    packages: row.packages,
    weightGrams: row.weightGrams,
    declaredValuePaise: row.declaredValuePaise ?? null,
    serviceLevel: row.serviceLevel as ShipmentDTO["serviceLevel"],
    paymentMode: row.paymentMode as ShipmentDTO["paymentMode"],
    status: row.status as ShipmentStatus,
    assignedTo: row.assignedTo
      ? {
          id: row.assignedTo,
          name: side.assignedName ?? "Unknown",
          email: side.assignedEmail ?? undefined,
          avatarUrl: side.assignedAvatar ?? null,
        }
      : null,
    createdBy: row.createdBy ? { id: row.createdBy, name: side.createdByName ?? "System" } : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expectedDelivery: row.expectedDelivery,
    deliveredAt: row.deliveredAt ?? null,
    delayReason: row.delayReason ?? null,
    notes: row.notes ?? null,
    lastSyncedAt: row.lastSyncedAt ?? null,
    syncState: row.syncState as SyncState,
    isOverdue: row.status !== "delivered" && row.expectedDelivery < now,
    checkpointCount: side.checkpointCount,
  };
}

export function rowToCheckpoint(row: CheckpointRow): CheckpointDTO {
  return {
    id: row.id,
    shipmentId: row.shipmentId,
    status: row.status as ShipmentStatus,
    label: row.label,
    location: row.location ?? null,
    note: row.note ?? null,
    delayReason: row.delayReason ?? null,
    occurredAt: row.occurredAt,
    recordedAt: row.recordedAt,
    source: row.source as CheckpointDTO["source"],
    byUserId: row.byUserId ?? null,
    byUserName: row.byUserName ?? null,
    rawPayload: row.rawPayload ?? undefined,
  };
}

export function rowToClient(
  row: ClientRow,
  counts?: { shipmentCount?: number; outstandingPaise?: number },
): ClientDTO {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    contactName: row.contactName ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    gstin: row.gstin ?? null,
    addressLine1: row.addressLine1 ?? null,
    addressLine2: row.addressLine2 ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    pincode: row.pincode ?? null,
    creditTermsDays: row.creditTermsDays ?? null,
    active: row.active,
    createdAt: row.createdAt,
    shipmentCount: counts?.shipmentCount,
    outstandingPaise: counts?.outstandingPaise,
  };
}

export function rowToCarrier(row: CarrierRow, openShipments?: number): Carrier {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code as Carrier["code"],
    name: row.name,
    adapter: row.adapter as Carrier["adapter"],
    trackingUrlTemplate: row.trackingUrlTemplate ?? null,
    supportsWebhook: row.supportsWebhook,
    active: row.active,
    priority: row.priority,
    openShipments,
    createdAt: row.createdAt,
  };
}

export function rowToLeadActivity(row: LeadActivityRow): LeadActivityDTO {
  return {
    id: row.id,
    leadId: row.leadId,
    kind: row.kind as LeadActivityKind,
    text: row.text,
    byUserId: row.byUserId ?? null,
    byUserName: row.byUserName ?? null,
    createdAt: row.createdAt,
  };
}

export function rowToLead(
  row: LeadRow,
  side: { assignedName?: string | null; activityCount?: number } = {},
  activities?: LeadDTO["activities"],
): LeadDTO {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    company: row.company,
    email: row.email ?? null,
    phone: row.phone ?? null,
    source: row.source as LeadDTO["source"],
    status: row.status as LeadDTO["status"],
    assignedTo: row.assignedTo ? { id: row.assignedTo, name: side.assignedName ?? "Unknown" } : null,
    notes: row.notes ?? null,
    nextFollowUp: row.nextFollowUp ?? null,
    expectedValuePaise: row.expectedValuePaise ?? null,
    convertedClientId: row.convertedClientId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    activities,
    activityCount: side.activityCount,
  };
}

export function rowToInvoice(
  row: InvoiceRow,
  side: {
    clientName: string;
    lineCount?: number;
    lines?: InvoiceDTO["lines"];
    shipments?: InvoiceDTO["shipments"];
  },
  now = Date.now(),
): InvoiceDTO {
  return {
    id: row.id,
    tenantId: row.tenantId,
    number: row.number,
    client: { id: row.clientId, name: side.clientName },
    status: row.status as InvoiceDTO["status"],
    subtotalPaise: row.subtotalPaise,
    taxPaise: row.taxPaise,
    totalPaise: row.totalPaise,
    currency: row.currency,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    paidAt: row.paidAt ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lineCount: side.lineCount,
    lines: side.lines,
    shipments: side.shipments,
    isOverdue: row.status !== "paid" && row.dueDate < now,
  };
}

export function rowToNotification(row: NotificationRow): NotificationDTO {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId ?? null,
    type: row.type as NotificationDTO["type"],
    title: row.title,
    message: row.message,
    shipmentId: row.shipmentId ?? null,
    invoiceId: row.invoiceId ?? null,
    readAt: row.readAt ?? null,
    createdAt: row.createdAt,
    channelsSent: (row.channelsSent ?? []) as NotificationDTO["channelsSent"],
  };
}

export function rowToAuditEvent(row: AuditRow): AuditEventDTO {
  return {
    id: row.id,
    tenantId: row.tenantId,
    occurredAt: row.occurredAt,
    actorType: row.actorType as AuditEventDTO["actorType"],
    actorId: row.actorId ?? null,
    actorName: row.actorName,
    actorAvatarUrl: row.actorAvatarUrl ?? null,
    action: row.action,
    entityType: row.entityType as AuditEventDTO["entityType"],
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    severity: row.severity as AuditEventDTO["severity"],
    summary: row.summary,
    changes: row.changes ?? null,
    ip: row.ip ?? null,
    userAgent: row.userAgent ?? null,
    requestId: row.requestId,
    source: row.source as AuditEventDTO["source"],
  };
}
