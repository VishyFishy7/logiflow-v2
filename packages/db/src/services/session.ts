/**
 * Session management — opaque tokens, hash-at-rest, sliding expiry.
 *
 * PRD §9.8:
 *   - Sessions are opaque tokens (not JWT), stored in the DB, so admins
 *     can revoke access and "who is logged in right now" is queryable.
 *   - 30-day rolling expiry, 90-day absolute cap.
 *   - `resolveActor()` is the ONE place `reveal` is derived — from the
 *     `tracking:reveal` permission in `permissionsFor(role)`.
 */
import { randomBytes, createHash } from "node:crypto";
import { eq, and, gt, isNull } from "drizzle-orm";
import {
  permissionsFor,
  grantFor,
  type Role,
  type Permission,
} from "@logiflow/shared";
import type { ThemePreference, SessionResponse, NotificationPrefs } from "@logiflow/contracts";
import { db, type Executor } from "../client.js";
import { sessions, users, tenants } from "../schema/index.js";
import { ApiError } from "../errors.js";
import { newId } from "@logiflow/shared";
import type { Actor } from "../actor.js";

// ── Constants ───────────────────────────────────────────────────────────────

/** Rolling expiry: 30 days in milliseconds. */
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

/** Absolute cap: 90 days in milliseconds. */
const SESSION_ABSOLUTE_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000;

/** Token bytes — 32 bytes = 256 bits of entropy, more than enough. */
const TOKEN_BYTES = 32;

// ── Token generation and hashing ────────────────────────────────────────────

/**
 * Generate an opaque session token — random bytes, base64url-encoded.
 * Never a guessable value (no timestamp, no sequential ID).
 */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Hash a session token for storage. The sessions table stores the hash,
 * not the raw token — so a DB breach doesn't compromise active sessions.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── Session CRUD ────────────────────────────────────────────────────────────

export interface SessionResult {
  /** The raw token — returned to the client exactly once. */
  token: string;
  /** The session ID. */
  sessionId: string;
  /** When the rolling expiry hits (epoch ms). */
  expiresAt: number;
}

type UserRow = typeof users.$inferSelect;

/**
 * Create a new session for a user. The raw token is returned to the caller;
 * only the hash is stored in the DB.
 */
export function createSession(
  user: UserRow,
  options: {
    ip?: string | null;
    userAgent?: string | null;
    requestId?: string;
  } = {},
): SessionResult {
  const now = Date.now();
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const sessionId = newId();

  db.insert(sessions)
    .values({
      id: sessionId,
      token: tokenHash,
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      ip: options.ip ?? null,
      userAgent: options.userAgent ?? null,
      expiresAt: now + SESSION_EXPIRY_MS,
      absoluteExpiresAt: now + SESSION_ABSOLUTE_EXPIRY_MS,
      revokedAt: null,
      createdAt: now,
      lastSeenAt: now,
    })
    .run();

  return {
    token,
    sessionId,
    expiresAt: now + SESSION_EXPIRY_MS,
  };
}

/**
 * Look up a session by its raw token. Returns the session row only if it
 * is not revoked and has not expired.
 *
 * The `token` parameter is the raw value from the client cookie; we hash
 * it before hitting the DB.
 */
export function getSession(token: string): (typeof sessions.$inferSelect) | null {
  const tokenHash = hashToken(token);
  const now = Date.now();

  return db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.token, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        gt(sessions.absoluteExpiresAt, now),
      ),
    )
    .get() ?? null;
}

/**
 * Revoke a single session by ID.
 */
export function revokeSession(sessionId: string): void {
  db.update(sessions)
    .set({ revokedAt: Date.now() })
    .where(eq(sessions.id, sessionId))
    .run();
}

/**
 * Revoke all sessions for a user (optionally keep one alive).
 */
export function revokeAllForUser(userId: string, _exceptSessionId?: string): void {
  // Revoke everything — simpler and safer. The caller can re-create
  // the current session if needed.
  db.update(sessions)
    .set({ revokedAt: Date.now() })
    .where(eq(sessions.userId, userId))
    .run();
}

/**
 * Sliding expiry: on every use, bump `expiresAt` forward. Also update
 * `lastSeenAt` for the "who is logged in" query.
 */
export function touchSession(sessionId: string): void {
  const now = Date.now();
  db.update(sessions)
    .set({
      expiresAt: now + SESSION_EXPIRY_MS,
      lastSeenAt: now,
    })
    .where(eq(sessions.id, sessionId))
    .run();
}

// ── Actor resolution ────────────────────────────────────────────────────────

/**
 * THE ONE PLACE `reveal` is derived.
 *
 * Resolve a session token into an `Actor` that every repository carries.
 * `reveal` is `true` when the user's role grants the `tracking:reveal`
 * permission — never re-derived from the role string in any other module.
 *
 * Returns `null` when the token is invalid, expired, or revoked.
 */
export function resolveActor(
  sessionToken: string,
  options?: {
    requestId?: string;
    source?: Actor["source"];
    ip?: string | null;
    userAgent?: string | null;
  },
): Actor | null {
  const session = getSession(sessionToken);
  if (!session) return null;

  // Bump the sliding expiry.
  touchSession(session.id);

  // Fetch the user to get name, email, and current role.
  const user = db.select().from(users).where(eq(users.id, session.userId)).get();
  if (!user) return null;

  const role = user.role as Role;
  const permissions = permissionsFor(role);

  // `reveal` is derived once, here, from the `tracking:reveal` permission.
  const reveal = grantFor(role, "tracking:reveal") !== "deny";

  return {
    userId: user.id,
    tenantId: session.tenantId,
    name: user.name,
    email: user.email,
    role,
    permissions,
    requestId: options?.requestId ?? "unknown",
    source: options?.source ?? "web",
    reveal,
    ip: options?.ip ?? session.ip,
    userAgent: options?.userAgent ?? session.userAgent,
  };
}

// ── SessionResponse builder ─────────────────────────────────────────────────

/**
 * Build the `SessionResponse` DTO (GET /auth/session).
 *
 * This is the shape the client receives: user + role + permissions + tenant
 * + per-permission scope record + themePref + notificationPrefs.
 */
export function buildSessionResponse(actor: Actor): SessionResponse {
  // Fetch the tenant.
  const tenant = db.select().from(tenants).where(eq(tenants.id, actor.tenantId)).get();
  if (!tenant) throw new ApiError("TENANT_NOT_FOUND", "Tenant not found");

  // Fetch the user for optional fields not on the Actor.
  const user = db.select().from(users).where(eq(users.id, actor.userId)).get();
  if (!user) throw new ApiError("USER_NOT_FOUND", "User not found");

  // Build the per-permission scope record.
  const scopes: Record<Permission, "all" | "assigned" | "own_clients" | "deny"> = {} as Record<
    Permission,
    "all" | "assigned" | "own_clients" | "deny"
  >;
  for (const perm of actor.permissions) {
    scopes[perm] = grantFor(actor.role, perm);
  }

  return {
    user: {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      phone: user.phone ?? undefined,
      role: actor.role,
      avatarUrl: user.avatarUrl ?? undefined,
      active: user.active,
      lastLoginAt: user.lastLoginAt ?? undefined,
      invitedBy: user.invitedBy ?? undefined,
      createdAt: user.createdAt,
    },
    role: actor.role,
    permissions: actor.permissions,
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      companyName: tenant.companyName,
      productName: tenant.productName,
      tagline: tenant.tagline,
      trackingPrefix: tenant.trackingPrefix,
      supportEmail: tenant.supportEmail,
      themePrimary: tenant.themePrimary,
      themePrimaryDark: tenant.themePrimaryDark,
      themeAccent: tenant.themeAccent,
      themeSidebarBg: tenant.themeSidebarBg,
      timezone: tenant.timezone,
      currency: tenant.currency,
      plan: tenant.plan as SessionResponse["tenant"]["plan"],
      maskPolicy: tenant.maskPolicy as SessionResponse["tenant"]["maskPolicy"],
      publicTrackingEnabled: tenant.publicTrackingEnabled,
      delayReasons: (tenant.delayReasons ?? []) as string[],
      leadSources: (tenant.leadSources ?? []) as string[],
      createdAt: tenant.createdAt,
    },
    scopes,
    themePref: (user.themePref as ThemePreference) ?? undefined,
    notificationPrefs: (user.notificationPrefs as NotificationPrefs) ?? undefined,
  };
}
