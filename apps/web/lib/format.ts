/**
 * Presentation helpers. Every label comes from `@logiflow/contracts` so the
 * UI, the CSV export and the audit log can never disagree on wording (§6.2).
 *
 * Tones are literal class strings, deliberately: Tailwind compiles the classes
 * it can see in source, so a tone must never be built by concatenation.
 */
import {
  DEFAULT_TIMEZONE,
  formatAuditTime,
  formatDateIst,
  formatDateTimeIst,
  formatMoney,
  formatMoneyCompact,
  formatMoneyPlain,
  formatRelative,
  formatWeight,
} from "@logiflow/shared";
import type {
  AuditSeverity,
  InvoiceStatus,
  LeadStatus,
  NotificationType,
  ServiceLevel,
  ShipmentStatus,
  SyncState,
} from "@logiflow/contracts";
import {
  INVOICE_STATUS_LABELS,
  LEAD_STATUS_LABELS,
  SERVICE_LEVEL_LABELS,
  SHIPMENT_STATUS_LABELS,
  SYNC_STATE_LABELS,
} from "@logiflow/contracts";

// ── money & dates ───────────────────────────────────────────────────────────
export const money = (paise: number | null | undefined): string =>
  typeof paise === "number" ? formatMoney(paise) : "—";

export const moneyPlain = (paise: number | null | undefined): string =>
  typeof paise === "number" ? formatMoneyPlain(paise) : "—";

export const moneyCompact = (paise: number | null | undefined): string =>
  typeof paise === "number" ? formatMoneyCompact(paise) : "—";

export const date = (ms: number | null | undefined, timeZone = DEFAULT_TIMEZONE): string =>
  typeof ms === "number" ? formatDateIst(ms, timeZone) : "—";

export const dateTime = (ms: number | null | undefined, timeZone = DEFAULT_TIMEZONE): string =>
  typeof ms === "number" ? formatDateTimeIst(ms, timeZone) : "—";

export const auditTime = (ms: number, now?: number, timeZone = DEFAULT_TIMEZONE): string =>
  formatAuditTime(ms, now ?? Date.now(), timeZone);

export const relative = (ms: number | null | undefined): string =>
  typeof ms === "number" ? formatRelative(ms) : "—";

export const weight = (grams: number | null | undefined): string =>
  typeof grams === "number" ? formatWeight(grams) : "—";

/** Whole days until a deadline; negative means overdue. Null-safe for tables. */
export function daysUntil(ms: number | null | undefined, now = Date.now()): number | null {
  if (typeof ms !== "number") return null;
  return Math.ceil((ms - now) / 86_400_000);
}

// ── labels ──────────────────────────────────────────────────────────────────
export const statusLabel = (status: ShipmentStatus): string => SHIPMENT_STATUS_LABELS[status];
export const leadStatusLabel = (status: LeadStatus): string => LEAD_STATUS_LABELS[status];
export const invoiceStatusLabel = (status: InvoiceStatus): string => INVOICE_STATUS_LABELS[status];
export const syncStateLabel = (state: SyncState): string => SYNC_STATE_LABELS[state];
export const serviceLevelLabel = (level: ServiceLevel): string => SERVICE_LEVEL_LABELS[level];

/**
 * Notification copy (§6.2): the five kinds the PRD defines, worded once here so
 * the bell, the drawer and any future email digest agree.
 */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  delay: "Delay",
  milestone: "Milestone",
  invoice: "Invoice",
  assignment: "Assignment",
  system: "System",
};

export const notificationTypeLabel = (type: NotificationType): string =>
  NOTIFICATION_TYPE_LABELS[type] ?? type;

/**
 * The quick-filter group from §8.4: shipments whose carrier has not yet issued
 * a tracking number are shown as one bucket in the list's status filter.
 */
export const AWAITING_CARRIER_ID = "awaiting_carrier_id";

export function shipmentListStatusLabel(value: string): string {
  if (value === AWAITING_CARRIER_ID) return "Awaiting carrier ID";
  if (value === "open") return "Open (not delivered)";
  return SHIPMENT_STATUS_LABELS[value as ShipmentStatus] ?? value;
}

// ── tones (PRD §12.4) ───────────────────────────────────────────────────────
const SHIPMENT_TONE: Record<string, string> = {
  pickup: "bg-[var(--status-pickup-bg)] text-[var(--status-pickup)]",
  warehouse: "bg-[var(--status-warehouse-bg)] text-[var(--status-warehouse)]",
  in_transit: "bg-[var(--status-in-transit-bg)] text-[var(--status-in-transit)]",
  delivered: "bg-[var(--status-delivered-bg)] text-[var(--status-delivered)]",
  delayed: "bg-[var(--status-delayed-bg)] text-[var(--status-delayed)]",
  [AWAITING_CARRIER_ID]: "bg-[var(--status-awaiting-carrier-bg)] text-[var(--status-awaiting-carrier)]",
};

const LEAD_TONE: Record<LeadStatus, string> = {
  new: "bg-[var(--status-new-bg)] text-[var(--status-new)]",
  contacted: "bg-[var(--status-contacted-bg)] text-[var(--status-contacted)]",
  negotiation: "bg-[var(--status-negotiation-bg)] text-[var(--status-negotiation)]",
  won: "bg-[var(--status-won-bg)] text-[var(--status-won)]",
  lost: "bg-[var(--status-lost-bg)] text-[var(--status-lost)]",
};

const INVOICE_TONE: Record<InvoiceStatus, string> = {
  paid: "bg-[var(--status-paid-bg)] text-[var(--status-paid)]",
  pending: "bg-[var(--status-pending-bg)] text-[var(--status-pending)]",
  overdue: "bg-[var(--status-overdue-bg)] text-[var(--status-overdue)]",
};

const SEVERITY_TONE: Record<AuditSeverity, string> = {
  info: "bg-[var(--severity-info-bg)] text-[var(--severity-info)]",
  warn: "bg-[var(--severity-warn-bg)] text-[var(--severity-warn)]",
  error: "bg-[var(--severity-error-bg)] text-[var(--severity-error)]",
};

const SEVERITY_DOT: Record<AuditSeverity, string> = {
  info: "bg-[var(--severity-info)]",
  warn: "bg-[var(--severity-warn)]",
  error: "bg-[var(--severity-error)]",
};

export const shipmentTone = (status: string, delayed = false): string =>
  delayed ? SHIPMENT_TONE.delayed! : (SHIPMENT_TONE[status] ?? SHIPMENT_TONE.pickup!);
export const leadTone = (status: LeadStatus): string => LEAD_TONE[status];
export const invoiceTone = (status: InvoiceStatus): string => INVOICE_TONE[status];
export const severityTone = (severity: AuditSeverity): string => SEVERITY_TONE[severity];
export const severityDot = (severity: AuditSeverity): string => SEVERITY_DOT[severity];

/** Chart colours are tokens too, so charts follow the theme (§12.3). */
export const chartColor = (index: 1 | 2 | 3 | 4 | 5): string => `var(--chart-${index})`;

// ── misc ────────────────────────────────────────────────────────────────────
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

/** A masked ID plus whether the viewer may copy the real value (§8.3). */
export interface MaskedText {
  value: string;
  raw?: string;
  masked: boolean;
  policy: string;
}

export const maskedText = (v: MaskedText | null | undefined): string => v?.value ?? "—";
export const canCopyRaw = (v: MaskedText | null | undefined): v is MaskedText & { raw: string } =>
  Boolean(v?.raw);

export function truncate(value: string, max = 40): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Percentage delta used by KPI cards; null when there is no baseline. */
export function deltaPercent(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
