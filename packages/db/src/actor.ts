import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import {
  grantFor,
  type Grant,
  type Permission,
  type Role,
} from "@logiflow/shared";
import type { AuditActorType, AuditSource } from "@logiflow/contracts";
import { clients, shipments } from "./schema/index.js";

/**
 * The identity every repository call carries. `reveal` is resolved once, at the
 * session boundary, from `tracking:reveal` — repositories never re-derive it
 * from the role, so there is exactly one place masking can be got wrong.
 */
export interface Actor {
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  requestId: string;
  source: AuditSource;
  reveal: boolean;
  ip?: string | null;
  userAgent?: string | null;
}

export function systemActor(tenantId: string, requestId: string, source: AuditSource = "job"): Actor {
  return {
    userId: "system",
    tenantId,
    name: "LogiFlow",
    email: "system@logiflow.local",
    role: "owner",
    permissions: [],
    requestId,
    source,
    reveal: false,
  };
}

export interface AuditActorRef {
  actorType: AuditActorType;
  actorId: string | null;
  actorName: string;
  actorAvatarUrl?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  source: AuditSource;
  requestId: string;
  tenantId: string;
}

/** The row-scope decision for a list or a single-row read (PRD §7.2). */
export type ScopeDecision = { grant: Grant; all: boolean };

export function decideScope(role: Role, permission: Permission): ScopeDecision {
  const grant = grantFor(role, permission);
  return { grant, all: grant === "all" };
}

/**
 * Row scope for shipments. PRD §7.2 resolves in this order:
 *  1. `shipment:read_all` = `all`       → tenant-wide
 *  2. `shipment:read_all` = `own_clients` → clients the actor created (Sales)
 *  3. `shipment:read_assigned` held      → only rows assigned to the actor
 *  4. otherwise                          → nothing
 * Accounts holds `read_all` but not `read_assigned`, so reading only the
 * assigned permission here would wrongly hide every shipment from them.
 */
export type ShipmentVisibility = "all" | "own_clients" | "assigned" | "none";

export function shipmentVisibility(actor: Actor): ShipmentVisibility {
  const readAll = grantFor(actor.role, "shipment:read_all");
  if (readAll === "all") return "all";
  if (readAll === "own_clients") return "own_clients";
  if (grantFor(actor.role, "shipment:read_assigned") !== "deny") return "assigned";
  return "none";
}

export function visibilityCondition(actor: Actor, visibility = shipmentVisibility(actor)): SQL | undefined {
  if (visibility === "all") return undefined;
  if (visibility === "assigned") return eq(shipments.assignedTo, actor.userId);
  if (visibility === "own_clients") {
    return inArray(
      shipments.clientId,
      sql`(SELECT ${clients.id} FROM ${clients} WHERE ${clients.createdBy} = ${actor.userId})`,
    );
  }
  return sql`0 = 1`;
}

/** Write-side scope for one permission (create/update/log_status/delete). */
export function shipmentScopeCondition(actor: Actor, permission: Permission): SQL | undefined {
  const grant = grantFor(actor.role, permission);
  if (grant === "all") return undefined;
  if (grant === "assigned") return eq(shipments.assignedTo, actor.userId);
  if (grant === "own_clients") {
    return inArray(
      shipments.clientId,
      sql`(SELECT ${clients.id} FROM ${clients} WHERE ${clients.createdBy} = ${actor.userId})`,
    );
  }
  return sql`0 = 1`;
}

/** Leads resolve the same way, off `lead:read_all` / `lead:read_assigned`. */
export function leadVisibility(actor: Actor): ShipmentVisibility {
  if (grantFor(actor.role, "lead:read_all") === "all") return "all";
  if (grantFor(actor.role, "lead:read_assigned") !== "deny") return "assigned";
  return "none";
}

/** Lead scope: same three cases, but the assignee column is on `leads`. */
export function scopeAllowsRow(
  actor: Actor,
  permission: Permission,
  row: { assignedTo?: string | null; createdBy?: string | null; clientCreatedBy?: string | null },
): boolean {
  const { grant, all } = decideScope(actor.role, permission);
  if (all) return true;
  if (grant === "assigned") return row.assignedTo === actor.userId;
  if (grant === "own_clients") return row.clientCreatedBy === actor.userId;
  return false;
}

export function andAll(...conditions: (SQL | undefined)[]): SQL | undefined {
  const present = conditions.filter((condition): condition is SQL => Boolean(condition));
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return and(...present);
}
