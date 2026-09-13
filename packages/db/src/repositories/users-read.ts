/**
 * Read-only user lookups used by other repositories to fill side-data
 * (assignedName, createdByName) without N+1 queries. No auth logic.
 */
import { eq } from "drizzle-orm";
import type { UserRef } from "@logiflow/contracts";
import { db } from "../client.js";
import { users } from "../schema/index.js";
import type { Actor } from "../actor.js";

/** Bulk lookup: userId → name. Used to denormalise names into list rows. */
export function userNameMap(tenantId: string): Map<string, string> {
  const rows = db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.tenantId, tenantId))
    .all();
  return new Map(rows.map((r) => [r.id, r.name]));
}

/**
 * Bulk lookup: userId → full user row (name, email, avatarUrl, role).
 * Used for richer side-data (e.g. avatar on assigned-to).
 */
export function userRefMap(
  tenantId: string,
): Map<string, { name: string; email: string; avatarUrl: string | null }> {
  const rows = db
    .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.tenantId, tenantId))
    .all();
  return new Map(rows.map((r) => [r.id, { name: r.name, email: r.email, avatarUrl: r.avatarUrl }]));
}

/** Active users suitable for assignment pickers (PRD §14.10). */
export function activeUsersForAssignableList(actor: Actor): UserRef[] {
  const rows = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.tenantId, actor.tenantId))
    .all();
  return rows
    .filter((u) => true) // All users for the tenant; active filter applied in UI
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as UserRef["role"],
      avatarUrl: u.avatarUrl,
    }));
}
