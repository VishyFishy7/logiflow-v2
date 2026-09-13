import { newId } from "@logiflow/shared";
import type { AuditSeverity } from "@logiflow/contracts";
import type { Executor } from "./client.js";
import { auditEvents } from "./schema/index.js";
import type { Actor, AuditActorRef } from "./actor.js";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  severity?: AuditSeverity;
  changes?: Record<string, { from: unknown; to: unknown }> | null;
}

/**
 * Only way a row enters `audit_events`. It takes the executor, so an audit row
 * is written inside the same transaction as the mutation it describes — there
 * is no code path that commits a shipment without its audit trail (PRD §9.2).
 */
export function recordAudit(exec: Executor, actor: Actor | AuditActorRef, entry: AuditEntry): string {
  const id = newId();
  const ref = toActorRef(actor);
  exec
    .insert(auditEvents)
    .values({
      id,
      tenantId: ref.tenantId,
      occurredAt: Date.now(),
      actorType: ref.actorType,
      actorId: ref.actorId,
      actorName: ref.actorName,
      actorAvatarUrl: ref.actorAvatarUrl ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityLabel: entry.entityLabel,
      severity: entry.severity ?? "info",
      summary: entry.summary,
      changes: entry.changes ?? null,
      ip: ref.ip ?? null,
      userAgent: ref.userAgent ?? null,
      requestId: ref.requestId,
      source: ref.source,
    })
    .run();
  return id;
}

function toActorRef(actor: Actor | AuditActorRef): AuditActorRef {
  if ("actorType" in actor) return actor;
  return {
    actorType: actor.userId === "system" ? "system" : "user",
    actorId: actor.userId === "system" ? null : actor.userId,
    actorName: actor.name,
    actorAvatarUrl: null,
    ip: actor.ip ?? null,
    userAgent: actor.userAgent ?? null,
    source: actor.source,
    requestId: actor.requestId,
    tenantId: actor.tenantId,
  };
}

/** Diff two plain objects into the `changes` payload, ignoring no-op fields. */
export function diffChanges<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> | null {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, next] of Object.entries(after)) {
    if (next === undefined) continue;
    const prev = before[key];
    if (JSON.stringify(prev ?? null) === JSON.stringify(next ?? null)) continue;
    changes[key] = { from: prev ?? null, to: next ?? null };
  }
  return Object.keys(changes).length > 0 ? changes : null;
}
