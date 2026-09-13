/**
 * Cross-cutting transport shapes: the list envelope, the one error shape, the
 * shared list query (PRD §4.5) and the masking envelope (§8.3). Every route
 * handler and every mock handler speaks exactly these.
 */
import { z } from "zod";
import type { MaskPolicy } from "@logiflow/shared";
import {
  zAuditSeverity,
  zCarrierCode,
  zCheckpointSource,
  zInvoiceStatus,
  zLeadStatus,
  zShipmentStatus,
  zShipmentStatus as zShipmentStatusAlias,
} from "./enums.js";

// ── Masking envelope ────────────────────────────────────────────────────────
export const zMaskPolicy = z.enum(["last2", "first2_last2", "full", "none"]);

/**
 * A value that may be masked. `raw` is present **only** when the caller holds
 * `tracking:reveal`; otherwise the payload carries the masked display string
 * and `masked: true` so the client can explain why it cannot copy the full ID.
 */
export const zMaskedValue = z.object({
  value: z.string(),
  raw: z.string().optional(),
  masked: z.boolean(),
  policy: zMaskPolicy,
});
export type MaskedValueDTO = z.infer<typeof zMaskedValue>;

export function maskedValueShape(policy: MaskPolicy) {
  return zMaskedValue.extend({ policy: z.literal(policy) });
}

// ── List envelope (PRD §4.5) ────────────────────────────────────────────────
export const zPagination = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export interface ListEnvelope<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function listEnvelope<T>(
  data: T[],
  params: { page: number; pageSize: number; total: number },
): ListEnvelope<T> {
  return {
    data,
    page: params.page,
    pageSize: params.pageSize,
    total: params.total,
    totalPages: params.pageSize > 0 ? Math.ceil(params.total / params.pageSize) : 0,
  };
}

export function zListResponse<T extends z.ZodTypeAny>(item: T) {
  return zPagination.extend({ data: z.array(item) });
}

/** Non-paginated single-item response. */
export const zItemResponse = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item });

// ── The one error shape (PRD §4.5) ──────────────────────────────────────────
export const API_ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "SHIPMENT_NOT_FOUND",
  "CLIENT_NOT_FOUND",
  "CARRIER_NOT_FOUND",
  "LEAD_NOT_FOUND",
  "INVOICE_NOT_FOUND",
  "USER_NOT_FOUND",
  "TENANT_NOT_FOUND",
  "DELAY_REASON_REQUIRED",
  "INVALID_STATUS_TRANSITION",
  "LAST_OWNER_PROTECTED",
  "EMAIL_ALREADY_EXISTS",
  "TRACKING_ID_CONFLICT",
  "IDEMPOTENCY_KEY_REUSED",
  "RATE_LIMITED",
  "INVALID_CREDENTIALS",
  "ACCOUNT_INACTIVE",
  "WEBHOOK_SIGNATURE_INVALID",
  "WEBHOOK_PAYLOAD_INVALID",
  "NOT_IMPLEMENTED",
  "INTERNAL_ERROR",
  "METHOD_NOT_ALLOWED",
  "UNSUPPORTED_QUERY_PARAM",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const zApiError = z.object({
  code: z.enum(API_ERROR_CODES),
  message: z.string(),
  fieldErrors: z.record(z.string()).optional(),
  requestId: z.string().optional(),
});

export const zApiErrorResponse = z.object({ error: zApiError });
export type ApiErrorResponse = z.infer<typeof zApiErrorResponse>;
export type ApiErrorBody = z.infer<typeof zApiError>;

/** HTTP status per error code — one table, so every handler agrees. */
export const ERROR_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SHIPMENT_NOT_FOUND: 404,
  CLIENT_NOT_FOUND: 404,
  CARRIER_NOT_FOUND: 404,
  LEAD_NOT_FOUND: 404,
  INVOICE_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  TENANT_NOT_FOUND: 404,
  DELAY_REASON_REQUIRED: 422,
  INVALID_STATUS_TRANSITION: 422,
  LAST_OWNER_PROTECTED: 409,
  EMAIL_ALREADY_EXISTS: 409,
  TRACKING_ID_CONFLICT: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  RATE_LIMITED: 429,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_INACTIVE: 403,
  WEBHOOK_SIGNATURE_INVALID: 401,
  WEBHOOK_PAYLOAD_INVALID: 400,
  NOT_IMPLEMENTED: 501,
  INTERNAL_ERROR: 500,
  METHOD_NOT_ALLOWED: 405,
  UNSUPPORTED_QUERY_PARAM: 400,
};

// ── The shared list query (PRD §4.5 / §11.5) ────────────────────────────────
/**
 * Accepts an ISO-8601 string (what the URL carries) or epoch milliseconds
 * (what the JSON API carries) and normalises to UTC milliseconds.
 */
export const zDateRangeParam = z.union([
  z.string().datetime({ offset: true }),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.coerce.number().int(),
]);

export const LIST_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "expectedDelivery",
  "status",
  "trackingId",
  "occurredAt",
  "totalPaise",
  "dueDate",
  "issueDate",
  "nextFollowUp",
  "name",
  "role",
  "lastLoginAt",
] as const;
export type ListSortField = (typeof LIST_SORT_FIELDS)[number];

export const zListQueryBase = z
  .object({
    q: z.string().trim().max(200).optional(),
    status: z.string().max(60).optional(),
    carrier: z.string().max(60).optional(),
    client: z.string().max(120).optional(),
    assignedTo: z.string().max(60).optional(),
    from: zDateRangeParam.optional(),
    to: zDateRangeParam.optional(),
    sort: z.string().max(60).optional(),
    dir: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(25),
  })
  .strict();

export type ListQuery = z.output<typeof zListQueryBase>;

/** Shared filter surface for shipments (adds the two operational extras). */
export const zShipmentListQuery = zListQueryBase.extend({
  /** `awaiting_carrier_id` is the quick-filter group from §8.4. */
  status: z.union([zShipmentStatusAlias, z.literal("awaiting_carrier_id"), z.literal("open")]).optional(),
  syncState: z.string().max(20).optional(),
});
export type ShipmentListQuery = z.output<typeof zShipmentListQuery>;

export type InvoiceListQuery = z.output<typeof zInvoiceListQuery>;
export type LeadListQuery = z.output<typeof zLeadListQuery>;

export const zInvoiceListQuery = zListQueryBase.extend({
  status: zInvoiceStatus.optional(),
});
export const zLeadListQuery = zListQueryBase.extend({
  status: zLeadStatus.optional(),
  source: z.string().max(40).optional(),
});

export const zAuditListQuery = zListQueryBase.extend({
  severity: zAuditSeverity.optional(),
  actorId: z.string().max(60).optional(),
  entityType: z.string().max(40).optional(),
  entityId: z.string().max(60).optional(),
  action: z.string().max(80).optional(),
  actionNamespace: z.string().max(40).optional(),
  source: z.string().max(20).optional(),
});
export type AuditListQuery = z.output<typeof zAuditListQuery>;

/** Query shape shared by both CSV exports. */
export const zExportQuery = zListQueryBase.partial({ page: true, pageSize: true }).extend({
  format: z.enum(["csv", "jsonl"]).optional(),
});

/** Response carrying the request id, echoed on every response (§4.5). */
export const zMeta = z.object({ requestId: z.string() });

export const zIdParam = z.string().min(1).max(60);
export const zIdempotencyKey = z.string().min(8).max(120);

/** Shared, reusable leaf schemas. */
export const zUserId = zIdParam;
export const zCarrierCodeOrId = z.union([zCarrierCode, zIdParam]);
export const zCheckpointSourceValue = zCheckpointSource;
export const zShipmentStatusValue = zShipmentStatus;
export const zSeverityValue = zAuditSeverity;
