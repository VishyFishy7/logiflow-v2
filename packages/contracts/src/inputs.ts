/**
 * Request payloads. Every mutating route parses one of these at the edge
 * (PRD §4.4 / §9.8) — the repository layer never sees an unvalidated body.
 */
import { z } from "zod";
import { ROLES, PERMISSIONS } from "@logiflow/shared";
import { DELAY_REASONS, LEAD_SOURCES, SERVICE_LEVELS } from "./enums";
import {
  zCarrierAdapterCode,
  zCarrierCode,
  zCheckpointSource,
  zDelayReason,
  zInvoiceStatus,
  zLeadActivityKind,
  zLeadSource,
  zLeadStatus,
  zNotificationChannel,
  zNotificationType,
  zPaymentMode,
  zServiceLevel,
  zShipmentStatus,
  zSyncState,
  zThemePreference,
} from "./enums";
import { zMaskPolicy } from "./common";

const zRole = z.enum(ROLES);
const zPermission = z.enum(PERMISSIONS);

/** Money in paise, non-negative, integer. */
const zPaise = z.number().int().min(0).max(100_000_000_000);
const zMs = z.number().int();
/** Accepts an ISO string or epoch ms and normalises to ms. */
const zMsInput = z.union([z.string().datetime({ offset: true }), z.coerce.number().int()]);
const zPincode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Pincode must be 6 digits");
const zGstin = z
  .string()
  .trim()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN")
  .optional();

// ── Auth ────────────────────────────────────────────────────────────────────
export const zLoginInput = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
  })
  .strict();
export type LoginInput = z.infer<typeof zLoginInput>;

export const zSignupInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8).max(200),
    companyName: z.string().trim().min(2).max(120),
    trackingPrefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{2,5}$/, "2–5 uppercase alphanumerics"),
  })
  .strict();
export type SignupInput = z.infer<typeof zSignupInput>;

export const zAcceptInviteInput = z
  .object({
    token: z.string().min(10),
    name: z.string().trim().min(2).max(80),
    password: z.string().min(8).max(200),
  })
  .strict();

export const zProfileUpdateInput = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{6,20}$/)
      .nullable()
      .optional(),
    avatarUrl: z.string().url().nullable().optional(),
    themePref: zThemePreference.nullable().optional(),
    notificationPrefs: z
      .record(zNotificationType, z.array(zNotificationChannel))
      .optional(),
  })
  .strict();
export type ProfileUpdateInput = z.infer<typeof zProfileUpdateInput>;

export const zChangePasswordInput = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(200),
  })
  .strict();

// ── Team (§9.1 / §14.10) ────────────────────────────────────────────────────
export const zTeamInviteInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email(),
    role: zRole,
  })
  .strict();
export type TeamInviteInput = z.infer<typeof zTeamInviteInput>;

export const zTeamUpdateInput = z
  .object({
    role: zRole.optional(),
    active: z.boolean().optional(),
    name: z.string().trim().min(2).max(80).optional(),
  })
  .strict();
export type TeamUpdateInput = z.infer<typeof zTeamUpdateInput>;

// ── Shipments (§14.4) ───────────────────────────────────────────────────────
export const zShipmentCreateInput = z
  .object({
    /** Free text accepted at the edge; resolved-or-created (§6.1). */
    client: z.string().trim().min(1).max(120),
    carrierId: z.string().min(1),
    origin: z.string().trim().min(1).max(80),
    destination: z.string().trim().min(1).max(80),
    originPincode: zPincode.optional(),
    destinationPincode: zPincode.optional(),
    referenceNumber: z.string().trim().max(60).optional(),
    invoiceNumber: z.string().trim().max(60).optional(),
    packages: z.number().int().min(1).max(9999),
    weightGrams: z.number().int().min(1).max(10_000_000),
    declaredValuePaise: zPaise.optional(),
    serviceLevel: zServiceLevel,
    paymentMode: zPaymentMode,
    expectedDelivery: zMsInput.optional(),
    assignedTo: z.string().nullable().optional(),
    notes: z.string().trim().max(2000).optional(),
    /** §8.4 order-of-preference #1. */
    bookWithCarrier: z.boolean().optional(),
    carrierTrackingId: z.string().trim().min(6).max(24).optional(),
  })
  .strict();
export type ShipmentCreateInput = z.infer<typeof zShipmentCreateInput>;

export const zShipmentUpdateInput = z
  .object({
    client: z.string().trim().min(1).max(120).optional(),
    carrierId: z.string().min(1).optional(),
    origin: z.string().trim().min(1).max(80).optional(),
    destination: z.string().trim().min(1).max(80).optional(),
    originPincode: zPincode.nullable().optional(),
    destinationPincode: zPincode.nullable().optional(),
    referenceNumber: z.string().trim().max(60).nullable().optional(),
    invoiceNumber: z.string().trim().max(60).nullable().optional(),
    packages: z.number().int().min(1).max(9999).optional(),
    weightGrams: z.number().int().min(1).max(10_000_000).optional(),
    declaredValuePaise: zPaise.nullable().optional(),
    serviceLevel: zServiceLevel.optional(),
    paymentMode: zPaymentMode.optional(),
    expectedDelivery: zMsInput.optional(),
    assignedTo: z.string().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    carrierTrackingId: z.string().trim().min(6).max(24).nullable().optional(),
  })
  .strict();
export type ShipmentUpdateInput = z.infer<typeof zShipmentUpdateInput>;

export const zCheckpointCreateInput = z
  .object({
    status: zShipmentStatus,
    label: z.string().trim().min(1).max(120).optional(),
    location: z.string().trim().max(120).optional(),
    note: z.string().trim().max(1000).optional(),
    delayReason: zDelayReason.optional(),
    occurredAt: zMsInput.optional(),
    source: zCheckpointSource.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // v1 constraint, kept and enforced at the edge as well as in the DB (§2.4).
    if (value.status === "delayed" && !value.delayReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["delayReason"],
        message: "A delay reason is required when status is delayed",
      });
    }
  });
export type CheckpointCreateInput = z.infer<typeof zCheckpointCreateInput>;

/** Bulk actions from §14.3. */
export const zShipmentBulkAssignInput = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(200),
    assignedTo: z.string().nullable(),
  })
  .strict();

export const zShipmentBulkStatusInput = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(200),
    status: zShipmentStatus,
    delayReason: zDelayReason.optional(),
    location: z.string().trim().max(120).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "delayed" && !value.delayReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["delayReason"],
        message: "A delay reason is required when status is delayed",
      });
    }
  });

// ── Clients ─────────────────────────────────────────────────────────────────
export const zClientCreateInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    contactName: z.string().trim().max(80).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().max(20).optional(),
    gstin: zGstin,
    addressLine1: z.string().trim().max(160).optional(),
    addressLine2: z.string().trim().max(160).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    pincode: zPincode.optional(),
    creditTermsDays: z.number().int().min(0).max(365).optional(),
  })
  .strict();
export type ClientCreateInput = z.infer<typeof zClientCreateInput>;

export const zClientUpdateInput = zClientCreateInput.partial().extend({
  active: z.boolean().optional(),
});
export type ClientUpdateInput = z.infer<typeof zClientUpdateInput>;

// ── Carriers ────────────────────────────────────────────────────────────────
export const zCarrierCreateInput = z
  .object({
    code: zCarrierCode,
    name: z.string().trim().min(2).max(80),
    adapter: zCarrierAdapterCode.default("mock"),
    trackingUrlTemplate: z.string().trim().max(300).nullable().optional(),
    supportsWebhook: z.boolean().default(false),
    active: z.boolean().default(true),
    priority: z.number().int().min(0).max(100).default(50),
  })
  .strict();
export type CarrierCreateInput = z.infer<typeof zCarrierCreateInput>;

export const zCarrierUpdateInput = zCarrierCreateInput.partial();
export type CarrierUpdateInput = z.infer<typeof zCarrierUpdateInput>;

// ── Leads ───────────────────────────────────────────────────────────────────
export const zLeadCreateInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    company: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().max(20).optional(),
    source: zLeadSource,
    status: zLeadStatus.default("new"),
    assignedTo: z.string().nullable().optional(),
    notes: z.string().trim().max(2000).optional(),
    nextFollowUp: zMsInput.nullable().optional(),
    expectedValuePaise: zPaise.optional(),
  })
  .strict();
export type LeadCreateInput = z.infer<typeof zLeadCreateInput>;

export const zLeadUpdateInput = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    company: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().toLowerCase().email().nullable().optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    source: zLeadSource.optional(),
    status: zLeadStatus.optional(),
    assignedTo: z.string().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    nextFollowUp: zMsInput.nullable().optional(),
    expectedValuePaise: zPaise.nullable().optional(),
  })
  .strict();
export type LeadUpdateInput = z.infer<typeof zLeadUpdateInput>;

export const zLeadActivityInput = z
  .object({
    kind: zLeadActivityKind.default("note"),
    text: z.string().trim().min(1).max(1000),
  })
  .strict();
export type LeadActivityInput = z.infer<typeof zLeadActivityInput>;

export const zLeadConvertInput = z
  .object({
    contactName: z.string().trim().max(80).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().max(20).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    pincode: zPincode.optional(),
  })
  .strict();

// ── Invoices ────────────────────────────────────────────────────────────────
export const zInvoiceLineInput = z
  .object({
    shipmentId: z.string().min(1).nullable().optional(),
    description: z.string().trim().min(1).max(200),
    amountPaise: zPaise,
    taxRateBp: z.number().int().min(0).max(10_000),
  })
  .strict();
export type InvoiceLineInput = z.infer<typeof zInvoiceLineInput>;

export const zInvoiceCreateInput = z
  .object({
    clientId: z.string().min(1),
    issueDate: zMsInput.optional(),
    dueDate: zMsInput,
    notes: z.string().trim().max(1000).optional(),
    lines: z.array(zInvoiceLineInput).min(1).max(100),
    status: zInvoiceStatus.default("pending"),
  })
  .strict();
export type InvoiceCreateInput = z.infer<typeof zInvoiceCreateInput>;

export const zInvoiceUpdateInput = z
  .object({
    status: zInvoiceStatus.optional(),
    dueDate: zMsInput.optional(),
    issueDate: zMsInput.optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    lines: z.array(zInvoiceLineInput).min(1).max(100).optional(),
  })
  .strict();
export type InvoiceUpdateInput = z.infer<typeof zInvoiceUpdateInput>;

// ── Notifications ───────────────────────────────────────────────────────────
export const zNotificationCreateInput = z
  .object({
    userId: z.string().nullable().optional(),
    type: zNotificationType,
    title: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(600),
    shipmentId: z.string().nullable().optional(),
    invoiceId: z.string().nullable().optional(),
    channels: z.array(zNotificationChannel).default(["inapp"]),
  })
  .strict();

// ── Tenant / brand / settings (§14.11) ──────────────────────────────────────
const zHex = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Expected a hex colour");

export const zBrandUpdateInput = z
  .object({
    companyName: z.string().trim().min(2).max(120).optional(),
    productName: z.string().trim().min(2).max(60).optional(),
    tagline: z.string().trim().max(160).optional(),
    supportEmail: z.string().trim().toLowerCase().email().optional(),
    themePrimary: zHex.optional(),
    themePrimaryDark: zHex.optional(),
    themeAccent: zHex.optional(),
    themeSidebarBg: zHex.optional(),
  })
  .strict();
export type BrandUpdateInput = z.infer<typeof zBrandUpdateInput>;

export const zTrackingSettingsInput = z
  .object({
    trackingPrefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{2,5}$/)
      .optional(),
    maskPolicy: zMaskPolicy.optional(),
    publicTrackingEnabled: z.boolean().optional(),
  })
  .strict();

export const zVocabularyInput = z
  .object({
    delayReasons: z.array(z.string().trim().min(2).max(60)).min(1).max(20).optional(),
    leadSources: z.array(z.string().trim().min(2).max(60)).min(1).max(20).optional(),
  })
  .strict();

export const zTenantUpdateInput = z
  .object({
    timezone: z.string().trim().min(3).max(60).optional(),
    currency: z.string().trim().length(3).optional(),
  })
  .strict();

export const zPermissionChangeInput = z.object({ role: zRole }).strict();

// ── Webhook (§9.1) ──────────────────────────────────────────────────────────
export const zCarrierWebhookInput = z
  .object({
    carrierTrackingId: z.string().trim().min(3).max(40).optional(),
    trackingId: z.string().trim().min(3).max(40).optional(),
    /** The carrier's own vocabulary; normalised by the adapter. */
    rawStatus: z.string().trim().min(1).max(60),
    location: z.string().trim().max(120).optional(),
    note: z.string().trim().max(500).optional(),
    occurredAt: zMsInput.optional(),
  })
  .strict()
  .refine((value) => Boolean(value.carrierTrackingId || value.trackingId), {
    message: "Either carrierTrackingId or trackingId is required",
    path: ["carrierTrackingId"],
  });

/** Deliberately loose: an unknown carrier status normalises to `in_transit`. */
export const zNormalisedStatus = zShipmentStatus;

export const DEFAULT_DELAY_REASONS = DELAY_REASONS;
export const DEFAULT_LEAD_SOURCES = LEAD_SOURCES;
export const DEFAULT_SERVICE_LEVELS = SERVICE_LEVELS;

export const zSyncStatePatch = z.object({ syncState: zSyncState }).strict();

export const zTeamPermissionPreview = z.object({
  role: zRole,
  permissions: z.array(zPermission),
});
