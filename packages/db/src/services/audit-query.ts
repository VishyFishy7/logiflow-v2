/**
 * Audit query parsing/normalisation — §9.2 / §11.7.
 *
 * Action namespace grouping, human summary/severity presentation rules,
 * and the JSONL export row shape for /audit/export.json.
 */
import {
  actionLabel as _actionLabel,
  actionNamespace as _actionNamespace,
  type AuditAction,
} from "@logiflow/contracts";
import type { AuditEventDTO, AuditSeverity } from "@logiflow/contracts";

// ── Namespace grouping ──────────────────────────────────────────────────────

/**
 * Group an action key into its namespace for the filter UI.
 * "shipment.status_changed" → "shipment"
 */
export function actionNamespace(action: string): string {
  return _actionNamespace(action);
}

/**
 * Human-readable label for an action key (§11.7 — tooltip on the action column).
 */
export function actionLabel(action: string): string {
  return _actionLabel(action);
}

// ── Severity presentation (§11.7) ───────────────────────────────────────────

export interface SeverityPresentation {
  label: string;
  /** Maps to the UI colour token: default = neutral, warn = amber, destructive = rose. */
  tone: "default" | "warn" | "destructive";
}

/**
 * Severity badge shown in the audit table.
 * §11.7: "dot + label, colour from the severity tokens
 *         (info neutral, warn amber, error rose)"
 */
export function severityPresentation(severity: AuditSeverity): SeverityPresentation {
  switch (severity) {
    case "info":
      return { label: "Info", tone: "default" };
    case "warn":
      return { label: "Warning", tone: "warn" };
    case "error":
      return { label: "Error", tone: "destructive" };
  }
}

// ── Human summary ───────────────────────────────────────────────────────────

/**
 * The summary line for an audit event — shown in the Detail column (§11.7).
 * The event's `summary` field is already a human sentence (set by `recordAudit`).
 */
export function humanSummary(event: AuditEventDTO): string {
  return event.summary;
}

// ── JSONL export row shape (§9.1 — /audit/export.json) ─────────────────────

/**
 * One JSON object per line, fields matching the DTO but with
 * formatted timestamps for compliance handoff.
 */
export interface AuditExportRow {
  id: string;
  /** ISO-8601 datetime string. */
  occurredAt: string;
  actorType: string;
  actorId: string | null;
  actorName: string;
  action: string;
  actionLabel: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  severity: string;
  summary: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  ip: string | null;
  source: string;
  requestId: string;
}

/**
 * Convert an AuditEventDTO to the JSONL export shape.
 * Timestamps are converted to ISO-8601; everything else passes through.
 */
export function toExportRow(event: AuditEventDTO): AuditExportRow {
  return {
    id: event.id,
    occurredAt: new Date(event.occurredAt).toISOString(),
    actorType: event.actorType,
    actorId: event.actorId ?? null,
    actorName: event.actorName,
    action: event.action,
    actionLabel: actionLabel(event.action),
    entityType: event.entityType,
    entityId: event.entityId,
    entityLabel: event.entityLabel,
    severity: event.severity,
    summary: event.summary,
    changes: (event.changes as Record<string, { from: unknown; to: unknown }> | null) ?? null,
    ip: event.ip ?? null,
    source: event.source,
    requestId: event.requestId,
  };
}
