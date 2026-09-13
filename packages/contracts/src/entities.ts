/**
 * Entity read models — what the API returns and what the UI renders.
 * Field-level detail comes from PRD §6.1; do not add a field here that is not
 * in §6. Timestamps are UTC milliseconds (integers), money is integer paise.
 */
import { z } from "zod";
import { ROLES, PERMISSIONS } from "@logiflow/shared";
import { zMaskedValue, zPagination } from "./common";
import {
  zAuditActorType,
  zAuditEntityType,
  zAuditSeverity,
  zAuditSource,
  zCarrierAdapterCode,
  zCarrierCode,
  zCheckpointSource,
  zInvoiceStatus,
  zJobStatus,
  zJobType,
  zLeadActivityKind,
  zLeadSource,
  zLeadStatus,
  zNotificationChannel,
  zNotificationType,
  zPaymentMode,
  zServiceLevel,
  zShipmentStatus,
  zSyncState,
  zTenantPlan,
  zThemePreference,
} from "./enums";

const zRole = z.enum(ROLES);
const zPermission = z.enum(PERMISSIONS);
const zMs = z.number().int();

// ── Tenant ──────────────────────────────────────────────────────────────────
export const zTenant = z.object({
  id: z.string(),
  slug: z.string(),
  companyName: z.string(),
  productName: z.string(),
  tagline: z.string(),
  trackingPrefix: z.string(),
  supportEmail: z.string(),
  themePrimary: z.string(),
  themePrimaryDark: z.string(),
  themeAccent: z.string(),
  themeSidebarBg: z.string(),
  timezone: z.string(),
  currency: z.string(),
  plan: zTenantPlan,
  /** §14.11 Tracking settings. */
  maskPolicy: z.enum(["last2", "first2_last2", "full", "none"]),
  publicTrackingEnabled: z.boolean(),
  delayReasons: z.array(z.string()),
  leadSources: z.array(z.string()),
  createdAt: zMs,
});
export type Tenant = z.infer<typeof zTenant>;

// ── User ────────────────────────────────────────────────────────────────────
export const zUser = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable().optional(),
  role: zRole,
  avatarUrl: z.string().nullable().optional(),
  active: z.boolean(),
  lastLoginAt: zMs.nullable().optional(),
  invitedBy: z.string().nullable().optional(),
  createdAt: zMs,
});
export type UserDTO = z.infer<typeof zUser>;

/** The trimmed shape embedded in list rows. */
export const zUserRef = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  role: zRole.optional(),
  avatarUrl: z.string().nullable().optional(),
});
export type UserRef = z.infer<typeof zUserRef>;

export const zNotificationPrefs = z.object({
  delay: z.array(zNotificationChannel),
  milestone: z.array(zNotificationChannel),
  invoice: z.array(zNotificationChannel),
  assignment: z.array(zNotificationChannel),
  system: z.array(zNotificationChannel),
});
export type NotificationPrefs = z.infer<typeof zNotificationPrefs>;

// ── Session (GET /auth/session) ─────────────────────────────────────────────
export const zSessionResponse = z.object({
  user: zUser,
  role: zRole,
  permissions: z.array(zPermission),
  tenant: zTenant,
  /** Server-resolved scope hints so the UI can label "assigned" views. */
  scopes: z.record(zPermission, z.enum(["all", "assigned", "own_clients", "deny"])),
  themePref: zThemePreference.nullable().optional(),
  notificationPrefs: zNotificationPrefs.optional(),
});
export type SessionResponse = z.infer<typeof zSessionResponse>;

// ── Client ──────────────────────────────────────────────────────────────────
export const zClient = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  contactName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  creditTermsDays: z.number().int().nullable().optional(),
  active: z.boolean(),
  createdAt: zMs,
  /** Aggregates shown on the clients table (§14.11). */
  shipmentCount: z.number().int().optional(),
  outstandingPaise: z.number().int().optional(),
});
export type ClientDTO = z.infer<typeof zClient>;

// ── Carrier ─────────────────────────────────────────────────────────────────
export const zCarrier = z.object({
  id: z.string(),
  tenantId: z.string(),
  code: zCarrierCode,
  name: z.string(),
  adapter: zCarrierAdapterCode,
  trackingUrlTemplate: z.string().nullable().optional(),
  supportsWebhook: z.boolean(),
  active: z.boolean(),
  priority: z.number().int(),
  /** Counts for the carriers table. */
  openShipments: z.number().int().optional(),
  createdAt: zMs,
});
export type Carrier = z.infer<typeof zCarrier>;

// ── Shipment ────────────────────────────────────────────────────────────────
export const zShipmentRoute = z.object({
  origin: z.string(),
  destination: z.string(),
  originPincode: z.string().nullable().optional(),
  destinationPincode: z.string().nullable().optional(),
});

/** List row. `trackingId` / `carrierTrackingId` are masked en envelopes (§8.3). */
export const zShipment = z.object({
  id: z.string(),
  tenantId: z.string(),
  trackingId: zMaskedValue,
  carrierTrackingId: zMaskedValue,
  carrierTrackingIdSetAt: zMs.nullable().optional(),
  client: z.object({ id: z.string(), name: z.string() }),
  carrier: z.object({ id: z.string(), code: zCarrierCode, name: z.string() }),
  route: zShipmentRoute,
  referenceNumber: z.string().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  packages: z.number().int(),
  weightGrams: z.number().int(),
  declaredValuePaise: z.number().int().nullable().optional(),
  serviceLevel: zServiceLevel,
  paymentMode: zPaymentMode,
  status: zShipmentStatus,
  assignedTo: zUserRef.nullable().optional(),
  createdBy: zUserRef.nullable().optional(),
  createdAt: zMs,
  updatedAt: zMs,
  expectedDelivery: zMs,
  deliveredAt: zMs.nullable().optional(),
  delayReason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lastSyncedAt: zMs.nullable().optional(),
  syncState: zSyncState,
  /** Derived flags the desk filters on. */
  isOverdue: z.boolean().optional(),
  checkpointCount: z.number().int().optional(),
});
export type ShipmentDTO = z.infer<typeof zShipment>;

export const zCheckpoint = z.object({
  id: z.string(),
  shipmentId: z.string(),
  status: zShipmentStatus,
  label: z.string(),
  location: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  delayReason: z.string().nullable().optional(),
  occurredAt: zMs,
  recordedAt: zMs,
  source: zCheckpointSource,
  byUserId: z.string().nullable().optional(),
  byUserName: z.string().nullable().optional(),
  rawPayload: z.unknown().optional(),
});
export type CheckpointDTO = z.infer<typeof zCheckpoint>;

export const zShipmentDetail = zShipment.extend({
  checkpoints: z.array(zCheckpoint),
  invoices: z.array(
    z.object({
      id: z.string(),
      number: z.string(),
      status: zInvoiceStatus,
      totalPaise: z.number().int(),
      dueDate: zMs,
    }),
  ),
  attachments: z.array(
    z.object({
      id: z.string(),
      filename: z.string(),
      mime: z.string(),
      size: z.number().int(),
      createdAt: zMs,
    }),
  ),
});
export type ShipmentDetailDTO = z.infer<typeof zShipmentDetail>;

// ── Lead ────────────────────────────────────────────────────────────────────
export const zLeadActivity = z.object({
  id: z.string(),
  leadId: z.string(),
  kind: zLeadActivityKind,
  text: z.string(),
  byUserId: z.string().nullable().optional(),
  byUserName: z.string().nullable().optional(),
  createdAt: zMs,
});
export type LeadActivityDTO = z.infer<typeof zLeadActivity>;

export const zLead = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  company: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  source: zLeadSource,
  status: zLeadStatus,
  assignedTo: zUserRef.nullable().optional(),
  notes: z.string().nullable().optional(),
  nextFollowUp: zMs.nullable().optional(),
  expectedValuePaise: z.number().int().nullable().optional(),
  convertedClientId: z.string().nullable().optional(),
  createdAt: zMs,
  updatedAt: zMs,
  activities: z.array(zLeadActivity).optional(),
  activityCount: z.number().int().optional(),
});
export type LeadDTO = z.infer<typeof zLead>;

// ── Invoice ─────────────────────────────────────────────────────────────────
export const zInvoiceLine = z.object({
  id: z.string(),
  invoiceId: z.string(),
  shipmentId: z.string().nullable().optional(),
  shipmentTrackingId: z.string().nullable().optional(),
  description: z.string(),
  amountPaise: z.number().int(),
  taxRateBp: z.number().int(),
});
export type InvoiceLineDTO = z.infer<typeof zInvoiceLine>;

export const zInvoice = z.object({
  id: z.string(),
  tenantId: z.string(),
  number: z.string(),
  client: z.object({ id: z.string(), name: z.string() }),
  status: zInvoiceStatus,
  subtotalPaise: z.number().int(),
  taxPaise: z.number().int(),
  totalPaise: z.number().int(),
  currency: z.string(),
  issueDate: zMs,
  dueDate: zMs,
  paidAt: zMs.nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: zMs,
  updatedAt: zMs,
  lineCount: z.number().int().optional(),
  lines: z.array(zInvoiceLine).optional(),
  shipments: z.array(z.object({ id: z.string(), trackingId: z.string() })).optional(),
  isOverdue: z.boolean().optional(),
});
export type InvoiceDTO = z.infer<typeof zInvoice>;

// ── Notification ────────────────────────────────────────────────────────────
export const zNotification = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string().nullable().optional(),
  type: zNotificationType,
  title: z.string(),
  message: z.string(),
  shipmentId: z.string().nullable().optional(),
  invoiceId: z.string().nullable().optional(),
  readAt: zMs.nullable().optional(),
  createdAt: zMs,
  channelsSent: z.array(zNotificationChannel),
});
export type NotificationDTO = z.infer<typeof zNotification>;

// ── Audit ───────────────────────────────────────────────────────────────────
export const zAuditEvent = z.object({
  id: z.string(),
  tenantId: z.string(),
  occurredAt: zMs,
  actorType: zAuditActorType,
  actorId: z.string().nullable().optional(),
  actorName: z.string(),
  actorAvatarUrl: z.string().nullable().optional(),
  action: z.string(),
  entityType: zAuditEntityType,
  entityId: z.string(),
  entityLabel: z.string(),
  severity: zAuditSeverity,
  summary: z.string(),
  changes: z.record(z.object({ from: z.unknown(), to: z.unknown() })).nullable().optional(),
  ip: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  requestId: z.string(),
  source: zAuditSource,
});
export type AuditEventDTO = z.infer<typeof zAuditEvent>;

// ── Attachment ──────────────────────────────────────────────────────────────
export const zAttachment = z.object({
  id: z.string(),
  tenantId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  filename: z.string(),
  mime: z.string(),
  size: z.number().int(),
  storageKey: z.string(),
  uploadedBy: z.string().nullable().optional(),
  createdAt: zMs,
});

// ── Aggregates: dashboard, analytics, lists ─────────────────────────────────
export const zKpiCard = z.object({
  id: z.string(),
  label: z.string(),
  value: z.number(),
  format: z.enum(["count", "money", "percent"]),
  deltaPercent: z.number().nullable().optional(),
  direction: z.enum(["up", "down", "flat"]).optional(),
  /** Sky-blue is the accent; green only for success states (§3.5). */
  tone: z.enum(["default", "accent", "warn", "success", "destructive"]).optional(),
  sparkline: z.array(z.number()).optional(),
  href: z.string().optional(),
});
export type KpiCard = z.infer<typeof zKpiCard>;

export const zStatusCount = z.object({
  status: z.string(),
  count: z.number().int(),
});

export const zDashboardStats = z.object({
  kpis: z.array(zKpiCard),
  shipmentsByStatus: z.array(zStatusCount),
  volumeByDay: z.array(z.object({ date: z.string(), created: z.number().int(), delivered: z.number().int() })),
  delayReasons: z.array(z.object({ reason: z.string(), count: z.number().int() })),
  needsAttention: z.object({
    delayedShipments: z.array(zShipment),
    overdueInvoices: z.array(zInvoice),
    followUpsToday: z.array(zLead),
  }),
  heatmap: z.array(z.object({ date: z.string(), count: z.number().int() })),
  /** Written when one aggregate fails while others succeed (§14.2). */
  partial: z.boolean().optional(),
  failedSections: z.array(z.string()).optional(),
});
export type DashboardStats = z.infer<typeof zDashboardStats>;

export const zAnalyticsStats = zDashboardStats.extend({
  carrierPerformance: z.array(
    z.object({
      carrierId: z.string(),
      carrier: z.string(),
      shipments: z.number().int(),
      onTime: z.number().int(),
      delayed: z.number().int(),
      avgTransitHours: z.number(),
    }),
  ),
  clientVolume: z.array(
    z.object({ clientId: z.string(), client: z.string(), shipments: z.number().int() }),
  ),
  clientRevenue: z.array(
    z.object({ clientId: z.string(), client: z.string(), revenuePaise: z.number().int() }),
  ),
});
export type AnalyticsStats = z.infer<typeof zAnalyticsStats>;

// ── Jobs, sequences, attachments (supporting tables) ───────────────────────
export const zJob = z.object({
  id: z.string(),
  tenantId: z.string(),
  type: zJobType,
  payload: z.unknown().nullable().optional(),
  runAt: zMs,
  attempts: z.number().int(),
  lastError: z.string().nullable().optional(),
  status: zJobStatus,
  naturalKey: z.string(),
  createdAt: zMs,
});

// ── Public tracking (§8.5 / §14.12) ────────────────────────────────────────
export const zPublicTrackingResponse = z.object({
  /** Echoed as entered — the visitor already has it. */
  trackingId: z.string(),
  carrierTrackingId: zMaskedValue,
  carrierName: z.string(),
  status: zShipmentStatus,
  serviceLevel: zServiceLevel,
  route: z.object({ origin: z.string(), destination: z.string() }),
  packages: z.number().int(),
  weightGrams: z.number().int(),
  expectedDelivery: zMs,
  deliveredAt: zMs.nullable().optional(),
  delayReason: z.string().nullable().optional(),
  lastUpdatedAt: zMs,
  brand: z.object({
    companyName: z.string(),
    productName: z.string(),
    supportEmail: z.string(),
    trackingPrefix: z.string(),
  }),
  checkpoints: z.array(
    z.object({
      status: zShipmentStatus,
      label: z.string(),
      location: z.string().nullable().optional(),
      occurredAt: zMs,
    }),
  ),
});
export type PublicTrackingResponse = z.infer<typeof zPublicTrackingResponse>;

/** Team list row (§14.10). */
export const zTeamMember = zUser.extend({
  activeShipments: z.number().int().optional(),
  permissionCount: z.number().int().optional(),
});

export const zCarrierBookingResult = z.object({
  carrierTrackingId: zMaskedValue,
  labelUrl: z.string().nullable().optional(),
  syncState: zSyncState,
});

export const zTrackingRevealResponse = z.object({
  shipmentId: z.string(),
  trackingId: zMaskedValue,
  carrierTrackingId: zMaskedValue,
  /** Seconds the client may keep the raw value before re-masking (§8.3). */
  revealSeconds: z.number().int(),
});

export const zPaginationValue = zPagination;

export const zBrandPreview = z.object({
  companyName: z.string(),
  productName: z.string(),
  tagline: z.string(),
  trackingPrefix: z.string(),
  supportEmail: z.string(),
  theme: z.object({
    primary: z.string(),
    primaryDark: z.string(),
    accent: z.string(),
    sidebarBg: z.string(),
  }),
});
export type BrandPreview = z.infer<typeof zBrandPreview>;
