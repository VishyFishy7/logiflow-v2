/**
 * The closed action-key namespace for the audit log (PRD §9.2).
 * Adding a key is a one-line change reviewed by a human.
 */
import { z } from "zod";
import type { AuditSeverity } from "./enums";

export const AUDIT_ACTIONS = [
  // shipment
  "shipment.created",
  "shipment.updated",
  "shipment.deleted",
  "shipment.status_changed",
  "shipment.tracking_assigned",
  "shipment.carrier_tracking_set",
  "shipment.assigned",
  "shipment.carrier_booked",
  "shipment.synced",
  "shipment.sync_failed",
  // checkpoint
  "checkpoint.logged",
  "checkpoint.received",
  // tracking
  "tracking.revealed",
  "tracking.copied",
  "tracking.lookup_succeeded",
  "tracking.lookup_failed",
  "tracking.rate_limited",
  // client
  "client.created",
  "client.updated",
  "client.resolved",
  // carrier
  "carrier.created",
  "carrier.updated",
  "carrier.webhook_secret_rotated",
  // lead
  "lead.created",
  "lead.updated",
  "lead.status_changed",
  "lead.activity_logged",
  "lead.converted",
  // invoice
  "invoice.created",
  "invoice.updated",
  "invoice.status_changed",
  "invoice.overdue_flagged",
  // team
  "team.invited",
  "team.role_changed",
  "team.deactivated",
  "team.reactivated",
  "team.invite_accepted",
  // auth
  "auth.login_succeeded",
  "auth.login_failed",
  "auth.logout",
  "auth.session_revoked",
  "auth.signup",
  // settings
  "settings.brand_updated",
  "settings.vocabulary_updated",
  "settings.tracking_updated",
  "settings.notification_prefs_updated",
  // export
  "export.requested",
  // system
  "system.job_run",
  "system.job_failed",
  "system.tenant_created",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export const zAuditAction = z.enum(AUDIT_ACTIONS);

/** Which namespace an action belongs to — powers the audit filter UI. */
export const AUDIT_ACTION_NAMESPACES = [
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
export type AuditActionNamespace = (typeof AUDIT_ACTION_NAMESPACES)[number];

export function actionNamespace(action: string): string {
  return action.split(".")[0] ?? "system";
}

/** Default severity per action; the call site may override (PRD §9.2). */
export const ACTION_SEVERITY: Partial<Record<AuditAction, AuditSeverity>> = {
  "shipment.status_changed": "info",
  "shipment.deleted": "warn",
  "shipment.sync_failed": "warn",
  "tracking.revealed": "warn",
  "tracking.lookup_failed": "warn",
  "tracking.rate_limited": "warn",
  "invoice.overdue_flagged": "warn",
  "auth.login_failed": "error",
  "auth.session_revoked": "warn",
  "system.job_failed": "error",
  "team.role_changed": "warn",
  "team.deactivated": "warn",
};

/** Human sentence for an action key, used in tooltips and the CSV export. */
export const ACTION_LABELS: Partial<Record<AuditAction, string>> = {
  "shipment.created": "Shipment created",
  "shipment.updated": "Shipment details edited",
  "shipment.deleted": "Shipment deleted",
  "shipment.status_changed": "Status changed",
  "shipment.tracking_assigned": "Internal tracking ID issued",
  "shipment.carrier_tracking_set": "Carrier docket recorded",
  "shipment.assigned": "Assignment changed",
  "shipment.carrier_booked": "Booked with carrier",
  "shipment.synced": "Carrier sync completed",
  "shipment.sync_failed": "Carrier sync failed",
  "checkpoint.logged": "Checkpoint logged",
  "checkpoint.received": "Carrier checkpoint received",
  "tracking.revealed": "Tracking ID revealed",
  "tracking.copied": "Tracking ID copied",
  "tracking.lookup_succeeded": "Public tracking lookup",
  "tracking.lookup_failed": "Public tracking miss",
  "tracking.rate_limited": "Public tracking rate limited",
  "client.created": "Client created",
  "client.updated": "Client updated",
  "client.resolved": "Client resolved from a free-text name",
  "carrier.created": "Carrier added",
  "carrier.updated": "Carrier updated",
  "carrier.webhook_secret_rotated": "Webhook secret rotated",
  "lead.created": "Lead created",
  "lead.updated": "Lead updated",
  "lead.status_changed": "Lead stage changed",
  "lead.activity_logged": "Lead activity logged",
  "lead.converted": "Lead converted to client",
  "invoice.created": "Invoice created",
  "invoice.updated": "Invoice updated",
  "invoice.status_changed": "Invoice status changed",
  "invoice.overdue_flagged": "Invoice marked overdue",
  "team.invited": "Teammate invited",
  "team.role_changed": "Role changed",
  "team.deactivated": "Teammate deactivated",
  "team.reactivated": "Teammate reactivated",
  "team.invite_accepted": "Invite accepted",
  "auth.login_succeeded": "Signed in",
  "auth.login_failed": "Sign-in failed",
  "auth.logout": "Signed out",
  "auth.session_revoked": "Session revoked",
  "auth.signup": "Workspace created",
  "settings.brand_updated": "Brand updated",
  "settings.vocabulary_updated": "Vocabulary updated",
  "settings.tracking_updated": "Tracking settings updated",
  "settings.notification_prefs_updated": "Notification preferences updated",
  "export.requested": "Export requested",
  "system.job_run": "Job ran",
  "system.job_failed": "Job failed",
  "system.tenant_created": "Tenant created",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action as AuditAction] ?? action;
}

export interface ChangeDiff {
  [field: string]: { from: unknown; to: unknown };
}

export const zChangeDiff = z.record(
  z.object({ from: z.unknown(), to: z.unknown() }),
) as unknown as z.ZodType<ChangeDiff>;
