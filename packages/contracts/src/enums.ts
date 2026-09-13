/**
 * Every enum in the product, in one place (PRD §6.2). `as const` arrays so the
 * Drizzle schema, the Zod validators, the forms, the CSV exporter and the
 * filters UI all read the same source. Never duplicate one as a literal union
 * inside a component.
 */
import { z } from "zod";

export const SHIPMENT_STATUSES = [
  "pickup",
  "warehouse",
  "in_transit",
  "delivered",
  "delayed",
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

/** On-path chain from §2.4 — `delayed` is reachable from any point. */
export const SHIPMENT_STATUS_ORDER = ["pickup", "warehouse", "in_transit", "delivered"] as const;

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  pickup: "Pickup",
  warehouse: "Warehouse",
  in_transit: "In transit",
  delivered: "Delivered",
  delayed: "Delayed",
};

export const DELAY_REASONS = [
  "Traffic congestion",
  "Customs / documentation hold",
  "Carrier issue",
  "Weather conditions",
  "Vehicle breakdown",
  "Consignee unavailable",
  "Other",
] as const;
export type DelayReason = (typeof DELAY_REASONS)[number];

export const SERVICE_LEVELS = ["surface", "air", "express"] as const;
export type ServiceLevel = (typeof SERVICE_LEVELS)[number];
export const SERVICE_LEVEL_LABELS: Record<ServiceLevel, string> = {
  surface: "Surface",
  air: "Air",
  express: "Express",
};

/** Default promised transit per service level, in days. */
export const SERVICE_LEVEL_TRANSIT_DAYS: Record<ServiceLevel, number> = {
  surface: 5,
  air: 3,
  express: 2,
};

export const PAYMENT_MODES = ["prepaid", "cod", "to_pay"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  prepaid: "Prepaid",
  cod: "COD",
  to_pay: "To pay",
};

export const SYNC_STATES = ["manual", "synced", "stale", "error"] as const;
export type SyncState = (typeof SYNC_STATES)[number];
export const SYNC_STATE_LABELS: Record<SyncState, string> = {
  manual: "Manual",
  synced: "Synced",
  stale: "Stale",
  error: "Error",
};

export const CHECKPOINT_SOURCES = ["manual", "carrier_webhook", "carrier_poll", "system"] as const;
export type CheckpointSource = (typeof CHECKPOINT_SOURCES)[number];
export const CHECKPOINT_SOURCE_LABELS: Record<CheckpointSource, string> = {
  manual: "Logged by operator",
  carrier_webhook: "Carrier webhook",
  carrier_poll: "Carrier poll",
  system: "System",
};

export const LEAD_STATUSES = ["new", "contacted", "negotiation", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const LEAD_SOURCES = [
  "Referral",
  "Website",
  "Cold outreach",
  "Trade show",
  "LinkedIn",
  "Existing client",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_ACTIVITY_KINDS = ["note", "call", "email", "status_change"] as const;
export type LeadActivityKind = (typeof LEAD_ACTIVITY_KINDS)[number];

export const INVOICE_STATUSES = ["paid", "pending", "overdue"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  overdue: "Overdue",
};

export const CARRIER_CODES = [
  "DHL",
  "SAFEXPRESS",
  "OM",
  "DTDC",
  "BLUEDART",
  "GATI",
  "OTHER",
] as const;
export type CarrierCode = (typeof CARRIER_CODES)[number];

/** v1's carrier vocabulary, preserved verbatim (PRD §2.4). */
export const CARRIER_NAMES: Record<CarrierCode, string> = {
  DHL: "DHL",
  SAFEXPRESS: "Safexpress",
  OM: "OM Logistics",
  DTDC: "DTDC",
  BLUEDART: "BlueDart",
  GATI: "Gati",
  OTHER: "Other",
};

export const CARRIER_ADAPTERS = [
  "mock",
  "dtdc",
  "delhivery",
  "bluedart",
  "shiprocket",
  "indiapost",
  "xpressbees",
] as const;
export type CarrierAdapterCode = (typeof CARRIER_ADAPTERS)[number];

export const NOTIFICATION_TYPES = [
  "delay",
  "milestone",
  "invoice",
  "assignment",
  "system",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ["inapp", "email", "whatsapp"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const AUDIT_SEVERITIES = ["info", "warn", "error"] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export const AUDIT_ACTOR_TYPES = ["user", "system", "carrier", "api_key"] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const AUDIT_SOURCES = ["web", "api", "webhook", "job"] as const;
export type AuditSource = (typeof AUDIT_SOURCES)[number];

export const AUDIT_ENTITY_TYPES = [
  "shipment",
  "checkpoint",
  "tracking",
  "client",
  "carrier",
  "lead",
  "invoice",
  "team",
  "auth",
  "settings",
  "export",
  "system",
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const TENANT_PLANS = ["trial", "standard", "enterprise"] as const;
export type TenantPlan = (typeof TENANT_PLANS)[number];

export const ATTACHMENT_ENTITY_TYPES = ["shipment", "invoice", "client", "lead"] as const;
export type AttachmentEntityType = (typeof ATTACHMENT_ENTITY_TYPES)[number];

export const JOB_TYPES = [
  "carrier_status_sync",
  "delayed_detection",
  "eta_recompute",
  "invoice_overdue_sweep",
  "notification_dispatch",
  "lead_follow_up_reminder",
  "audit_retention",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ["queued", "running", "done", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

// ── Zod enums derived from the arrays above ─────────────────────────────────
export const zShipmentStatus = z.enum(SHIPMENT_STATUSES);
export const zDelayReason = z.enum(DELAY_REASONS);
export const zServiceLevel = z.enum(SERVICE_LEVELS);
export const zPaymentMode = z.enum(PAYMENT_MODES);
export const zSyncState = z.enum(SYNC_STATES);
export const zCheckpointSource = z.enum(CHECKPOINT_SOURCES);
export const zLeadStatus = z.enum(LEAD_STATUSES);
export const zLeadSource = z.enum(LEAD_SOURCES);
export const zLeadActivityKind = z.enum(LEAD_ACTIVITY_KINDS);
export const zInvoiceStatus = z.enum(INVOICE_STATUSES);
export const zCarrierCode = z.enum(CARRIER_CODES);
export const zCarrierAdapterCode = z.enum(CARRIER_ADAPTERS);
export const zNotificationType = z.enum(NOTIFICATION_TYPES);
export const zNotificationChannel = z.enum(NOTIFICATION_CHANNELS);
export const zAuditSeverity = z.enum(AUDIT_SEVERITIES);
export const zAuditActorType = z.enum(AUDIT_ACTOR_TYPES);
export const zAuditSource = z.enum(AUDIT_SOURCES);
export const zAuditEntityType = z.enum(AUDIT_ENTITY_TYPES);
export const zTenantPlan = z.enum(TENANT_PLANS);
export const zJobType = z.enum(JOB_TYPES);
export const zJobStatus = z.enum(JOB_STATUSES);
export const zAttachmentEntityType = z.enum(ATTACHMENT_ENTITY_TYPES);
export const zThemePreference = z.enum(THEME_PREFERENCES);
