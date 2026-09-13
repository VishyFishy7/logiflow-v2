/**
 * User / team repository — list, get, create, update, deactivate, change role.
 *
 * PRD §14.10 — Team screen. Every write is in a sync transaction with
 * `recordAudit`. Last-owner protection: ApiError('LAST_OWNER_PROTECTED')
 * when demoting/deactivating the final active owner.
 */
import { and, eq, sql, asc, desc, like, or, type SQL } from "drizzle-orm";
import { newId, permissionsFor, can, type Role } from "@logiflow/shared";
import type { ListEnvelope } from "@logiflow/contracts";
import { db, type Executor } from "../client.js";
import { users, shipments } from "../schema/index.js";
import { ApiError } from "../errors.js";
import { recordAudit, diffChanges } from "../audit.js";
import type { Actor } from "../actor.js";

// ── Types ───────────────────────────────────────────────────────────────────

/** Team member row for the team table (§14.10). */
export interface TeamMember {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
  active: boolean;
  lastLoginAt: number | null;
  invitedBy: string | null;
  createdAt: number;
  activeShipments: number;
  permissionCount: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Count the number of active owners in a tenant.
 */
function countActiveOwners(exec: Executor, tenantId: string): number {
  const row = exec
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.role, "owner"), eq(users.active, true)))
    .get();
  return row?.count ?? 0;
}

/**
 * Check whether the user being modified is the last active owner.
 * Throws LAST_OWNER_PROTECTED if so.
 */
function assertNotLastOwner(exec: Executor, tenantId: string, userId: string, newRole?: string): void {
  // If the user is not currently an owner, or if the new role is still owner, no problem.
  const user = exec.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return;
  if (user.role !== "owner") return;
  if (newRole === "owner") return;

  // User is currently an owner and would be demoted — check if they're the last one.
  const ownerCount = countActiveOwners(exec, tenantId);
  if (ownerCount <= 1) {
    throw new ApiError("LAST_OWNER_PROTECTED", "Cannot demote or deactivate the last active owner");
  }
}

// ── listTeam ────────────────────────────────────────────────────────────────

/**
 * List all team members for a tenant.
 *
 * Returns `TeamMember[]` with active shipment counts and permission counts.
 */
export function listTeam(
  actor: Actor,
  query: {
    q?: string;
    sort?: string;
    dir?: "asc" | "desc";
    page?: number;
    pageSize?: number;
  } = {},
): ListEnvelope<TeamMember> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const conditions: SQL[] = [eq(users.tenantId, actor.tenantId)];

  if (query.q) {
    const needle = `%${query.q.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${users.name})`, needle),
        like(sql`lower(${users.email})`, needle),
      )!,
    );
  }

  const where = and(...conditions);

  // Sort column.
  const sortColumn =
    query.sort === "email"
      ? users.email
      : query.sort === "role"
        ? users.role
        : query.sort === "lastLoginAt"
          ? users.lastLoginAt
          : users.name;
  const dirFn = query.dir === "desc" ? desc : asc;

  const total = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(where)
    .get()?.count ?? 0;

  const rows = db
    .select({
      user: users,
      activeShipments: sql<number>`(
        SELECT count(*) FROM ${shipments}
        WHERE ${shipments.assignedTo} = ${users.id}
          AND ${shipments.deletedAt} IS NULL
          AND ${shipments.status} != 'delivered'
      )`,
    })
    .from(users)
    .where(where)
    .orderBy(dirFn(sortColumn))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  const data: TeamMember[] = rows.map((row) => ({
    id: row.user.id,
    tenantId: row.user.tenantId,
    name: row.user.name,
    email: row.user.email,
    phone: row.user.phone,
    role: row.user.role,
    avatarUrl: row.user.avatarUrl,
    active: row.user.active,
    lastLoginAt: row.user.lastLoginAt,
    invitedBy: row.user.invitedBy,
    createdAt: row.user.createdAt,
    activeShipments: row.activeShipments,
    permissionCount: permissionsFor(row.user.role as Role).length,
  }));

  return {
    data,
    page,
    pageSize,
    total,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  };
}

// ── getUser ─────────────────────────────────────────────────────────────────

/**
 * Get a single user by ID within the tenant.
 */
export function getUser(tenantId: string, userId: string): typeof users.$inferSelect | null {
  return (
    db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .get() ?? null
  );
}

// ── createUser ──────────────────────────────────────────────────────────────

/**
 * Create a new user (admin flow). The caller is responsible for hashing
 * the password before passing it in.
 */
export function createUser(
  actor: Actor,
  input: {
    name: string;
    email: string;
    role: Role;
    passwordHash: string;
    phone?: string | null;
    avatarUrl?: string | null;
    invitedBy?: string | null;
  },
): typeof users.$inferSelect {
  const now = Date.now();
  const id = newId();

  // Check email uniqueness.
  const existing = db
    .select()
    .from(users)
    .where(and(eq(users.tenantId, actor.tenantId), eq(users.email, input.email.toLowerCase().trim())))
    .get();
  if (existing) {
    throw new ApiError("EMAIL_ALREADY_EXISTS", "A user with this email already exists");
  }

  const user = db
    .insert(users)
    .values({
      id,
      tenantId: actor.tenantId,
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      role: input.role,
      passwordHash: input.passwordHash,
      phone: input.phone ?? null,
      avatarUrl: input.avatarUrl ?? null,
      invitedBy: input.invitedBy ?? null,
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  recordAudit(db, actor, {
    action: "team.user_created",
    entityType: "team",
    entityId: user.id,
    entityLabel: user.email,
    summary: `Created user ${user.name} (${user.email}) as ${user.role}`,
    severity: "info",
    changes: { role: { from: null, to: user.role } },
  });

  return user;
}

// ── updateUser ──────────────────────────────────────────────────────────────

/**
 * Update a user's profile fields (name, phone, avatar). Diff-captures
 * changes into the audit log.
 */
export function updateUser(
  actor: Actor,
  userId: string,
  input: {
    name?: string;
    phone?: string | null;
    avatarUrl?: string | null;
  },
): typeof users.$inferSelect {
  const now = Date.now();

  const before = db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, actor.tenantId)))
    .get();
  if (!before) throw new ApiError("USER_NOT_FOUND", "User not found");

  const patch: Record<string, unknown> = { updatedAt: now };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;

  const after = db.update(users).set(patch).where(eq(users.id, userId)).returning().get();

  const changes = diffChanges(
    { name: before.name, phone: before.phone, avatarUrl: before.avatarUrl },
    { name: after.name, phone: after.phone, avatarUrl: after.avatarUrl },
  );

  if (changes) {
    recordAudit(db, actor, {
      action: "team.user_updated",
      entityType: "team",
      entityId: userId,
      entityLabel: after.email,
      summary: `Updated user ${after.name}`,
      severity: "info",
      changes,
    });
  }

  return after;
}

// ── deactivateUser ──────────────────────────────────────────────────────────

/**
 * Deactivate a user. Enforces last-owner protection.
 */
export function deactivateUser(actor: Actor, userId: string): void {
  const now = Date.now();

  const target = db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, actor.tenantId)))
    .get();
  if (!target) throw new ApiError("USER_NOT_FOUND", "User not found");
  if (!target.active) return; // Already inactive — no-op.

  // Last-owner protection.
  assertNotLastOwner(db, actor.tenantId, userId);

  db.update(users)
    .set({ active: false, updatedAt: now })
    .where(eq(users.id, userId))
    .run();

  recordAudit(db, actor, {
    action: "team.deactivated",
    entityType: "team",
    entityId: userId,
    entityLabel: target.email,
    summary: `Deactivated ${target.name} (${target.email})`,
    severity: "info",
    changes: { active: { from: true, to: false } },
  });
}

// ── changeRole ──────────────────────────────────────────────────────────────

/**
 * Change a user's role. Enforces last-owner protection when demoting
 * the final active owner.
 */
export function changeRole(actor: Actor, userId: string, newRole: Role): void {
  const now = Date.now();

  const target = db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, actor.tenantId)))
    .get();
  if (!target) throw new ApiError("USER_NOT_FOUND", "User not found");

  const oldRole = target.role;
  if (oldRole === newRole) return; // No change.

  // Last-owner protection.
  assertNotLastOwner(db, actor.tenantId, userId, newRole);

  db.update(users)
    .set({ role: newRole, updatedAt: now })
    .where(eq(users.id, userId))
    .run();

  recordAudit(db, actor, {
    action: "team.role_changed",
    entityType: "team",
    entityId: userId,
    entityLabel: target.email,
    summary: `Changed ${target.name}'s role from ${oldRole} to ${newRole}`,
    severity: "info",
    changes: { role: { from: oldRole, to: newRole } },
  });
}
