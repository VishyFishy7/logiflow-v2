/**
 * Invite management — create, accept, resend, revoke.
 *
 * PRD §9.1 / §14.10:
 *   - Invite creates an inactive user + a single-use token with an expiry.
 *   - Accept sets the user's password and activates the account.
 *   - Invite emails go through a callback — the notification/mail service
 *     is another lane's file; we do NOT import it.
 */
import { eq, and, isNull, gt } from "drizzle-orm";
import { newId, newInviteToken } from "@logiflow/shared";
import type { Role } from "@logiflow/shared";
import { db } from "../client.js";
import { users, inviteTokens, tenants } from "../schema/index.js";
import { ApiError } from "../errors.js";
import { recordAudit } from "../audit.js";
import type { Actor } from "../actor.js";
import { hashPassword, checkPasswordStrength } from "./auth.js";

// ── Constants ───────────────────────────────────────────────────────────────

/** Invite tokens expire after 7 days. */
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// ── Types ───────────────────────────────────────────────────────────────────

export interface InviteResult {
  /** The invite token (returned to the caller to include in the email). */
  token: string;
  /** The invite record ID. */
  inviteId: string;
  /** When the token expires (epoch ms). */
  expiresAt: number;
}

/**
 * Callback type for sending invite emails. The caller (route handler)
 * provides this so we don't couple to the notification service.
 */
export type SendInviteEmail = (params: {
  email: string;
  name: string;
  token: string;
  invitedByName: string;
  companyName: string;
}) => Promise<void>;

// ── Create Invite ───────────────────────────────────────────────────────────

/**
 * Create an invite for a new team member.
 *
 * Creates an inactive user + a single-use invite token. The caller passes
 * a `sendInviteEmail` callback to deliver the email — we don't import the
 * mail service.
 *
 * @param actor    The user performing the invite (must have `team:manage`).
 * @param input    `{ name, email, role }`.
 * @param sendEmail  Callback to deliver the invite email.
 * @returns The invite token and metadata.
 */
export function createInvite(
  actor: Actor,
  input: { name: string; email: string; role: Role },
  sendEmail?: SendInviteEmail,
): InviteResult {
  const email = input.email.toLowerCase().trim();
  const now = Date.now();

  // Check if a user with this email already exists in the tenant.
  const existing = db
    .select()
    .from(users)
    .where(and(eq(users.tenantId, actor.tenantId), eq(users.email, email)))
    .get();

  if (existing) {
    throw new ApiError("EMAIL_ALREADY_EXISTS", "A user with this email already exists");
  }

  // Create an inactive placeholder user.
  const userId = newId();
  const placeholderHash = hashPassword(Math.random().toString(36).slice(2) + "Placeholder1");

  db.insert(users)
    .values({
      id: userId,
      tenantId: actor.tenantId,
      name: input.name.trim(),
      email,
      role: input.role,
      passwordHash: placeholderHash,
      active: false, // Inactive until invite is accepted.
      invitedBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Create the invite token.
  const token = newInviteToken();
  const inviteId = newId();
  const expiresAt = now + INVITE_EXPIRY_MS;

  db.insert(inviteTokens)
    .values({
      id: inviteId,
      tenantId: actor.tenantId,
      userId,
      token,
      role: input.role,
      invitedBy: actor.userId,
      expiresAt,
      acceptedAt: null,
      createdAt: now,
    })
    .run();

  // Audit the invite.
  recordAudit(db, actor, {
    action: "team.invited",
    entityType: "team",
    entityId: userId,
    entityLabel: email,
    summary: `Invited ${input.name} (${email}) as ${input.role}`,
    severity: "info",
    changes: { role: { from: null, to: input.role } },
  });

  // Send the email if a callback is provided.
  if (sendEmail) {
    const tenant = db.select().from(tenants).where(eq(tenants.id, actor.tenantId)).get();
    const companyName = tenant?.companyName ?? "LogiFlow";
    void sendEmail({
      email,
      name: input.name,
      token,
      invitedByName: actor.name,
      companyName,
    });
  }

  return { token, inviteId, expiresAt };
}

// ── Accept Invite ───────────────────────────────────────────────────────────

/**
 * Accept an invite: validate the token, set the user's name and password,
 * activate the account, consume the token, and audit the event.
 *
 * @param token     The invite token from the email.
 * @param name      The new user's display name.
 * @param password  The new user's chosen password.
 * @returns The activated user ID and tenant ID.
 */
export function acceptInvite(
  token: string,
  name: string,
  password: string,
): { userId: string; tenantId: string; role: Role } {
  const now = Date.now();

  // Validate password strength.
  const violations = checkPasswordStrength(password);
  if (violations.length > 0) {
    throw new ApiError("VALIDATION_FAILED", violations.join("; "), {
      fieldErrors: { password: violations[0] ?? "Password too weak" },
    });
  }

  // Find the invite token.
  const invite = db
    .select()
    .from(inviteTokens)
    .where(
      and(
        eq(inviteTokens.token, token),
        isNull(inviteTokens.acceptedAt),
        gt(inviteTokens.expiresAt, now),
      ),
    )
    .get();

  if (!invite) {
    throw new ApiError("NOT_FOUND", "Invalid or expired invite token");
  }

  // Hash the password.
  const passwordHash = hashPassword(password);

  // Activate the user and set their name + password.
  db.update(users)
    .set({
      name: name.trim(),
      passwordHash,
      active: true,
      updatedAt: now,
    })
    .where(eq(users.id, invite.userId))
    .run();

  // Mark the invite as accepted.
  db.update(inviteTokens)
    .set({ acceptedAt: now })
    .where(eq(inviteTokens.id, invite.id))
    .run();

  // Audit the acceptance.
  const user = db.select().from(users).where(eq(users.id, invite.userId)).get();
  if (user) {
    recordAudit(db, {
      actorType: "user",
      actorId: user.id,
      actorName: user.name,
      source: "web",
      requestId: "accept-invite",
      tenantId: invite.tenantId,
    }, {
      action: "team.invite_accepted",
      entityType: "team",
      entityId: user.id,
      entityLabel: user.email,
      summary: `${user.name} accepted the invite and joined as ${invite.role}`,
      severity: "info",
      changes: { active: { from: false, to: true } },
    });
  }

  return {
    userId: invite.userId,
    tenantId: invite.tenantId,
    role: invite.role as Role,
  };
}

// ── Resend Invite ───────────────────────────────────────────────────────────

/**
 * Resend an invite — generate a new token, invalidate the old one.
 */
export function resendInvite(
  actor: Actor,
  userId: string,
  sendEmail?: SendInviteEmail,
): InviteResult {
  const now = Date.now();

  // Find the user.
  const user = db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, actor.tenantId)))
    .get();

  if (!user) throw new ApiError("USER_NOT_FOUND", "User not found");
  if (user.active) throw new ApiError("VALIDATION_FAILED", "User is already active");

  // Invalidate old tokens.
  db.update(inviteTokens)
    .set({ expiresAt: now }) // Expire immediately.
    .where(
      and(
        eq(inviteTokens.userId, userId),
        eq(inviteTokens.tenantId, actor.tenantId),
        isNull(inviteTokens.acceptedAt),
      ),
    )
    .run();

  // Create a new token.
  const token = newInviteToken();
  const inviteId = newId();
  const expiresAt = now + INVITE_EXPIRY_MS;

  db.insert(inviteTokens)
    .values({
      id: inviteId,
      tenantId: actor.tenantId,
      userId,
      token,
      role: user.role,
      invitedBy: actor.userId,
      expiresAt,
      acceptedAt: null,
      createdAt: now,
    })
    .run();

  // Audit the resend.
  recordAudit(db, actor, {
    action: "team.invite_resent",
    entityType: "team",
    entityId: userId,
    entityLabel: user.email,
    summary: `Resent invite to ${user.email}`,
    severity: "info",
  });

  // Send the email if a callback is provided.
  if (sendEmail) {
    void sendEmail({
      email: user.email,
      name: user.name,
      token,
      invitedByName: actor.name,
      companyName: "LogiFlow",
    });
  }

  return { token, inviteId, expiresAt };
}

// ── Revoke Invite ───────────────────────────────────────────────────────────

/**
 * Revoke a pending invite — deactivate the placeholder user and expire the token.
 */
export function revokeInvite(actor: Actor, userId: string): void {
  const now = Date.now();

  const user = db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, actor.tenantId)))
    .get();

  if (!user) throw new ApiError("USER_NOT_FOUND", "User not found");
  if (user.active) throw new ApiError("VALIDATION_FAILED", "Cannot revoke an active user's invite");

  // Expire all pending tokens for this user.
  db.update(inviteTokens)
    .set({ expiresAt: now })
    .where(
      and(
        eq(inviteTokens.userId, userId),
        eq(inviteTokens.tenantId, actor.tenantId),
        isNull(inviteTokens.acceptedAt),
      ),
    )
    .run();

  // Delete the placeholder user.
  db.delete(users).where(eq(users.id, userId)).run();

  // Audit the revocation.
  recordAudit(db, actor, {
    action: "team.invite_revoked",
    entityType: "team",
    entityId: userId,
    entityLabel: user.email,
    summary: `Revoked invite for ${user.email}`,
    severity: "info",
  });
}
