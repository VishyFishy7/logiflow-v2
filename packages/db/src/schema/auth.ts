import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { NotificationPrefs } from "@logiflow/contracts";

/** Users, sessions, OAuth accounts and invites (PRD §4.3 / §6.1). */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    role: text("role").notNull(),
    avatarUrl: text("avatar_url"),
    passwordHash: text("password_hash").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    lastLoginAt: integer("last_login_at"),
    invitedBy: text("invited_by"),
    themePref: text("theme_pref"),
    notificationPrefs: text("notification_prefs", { mode: "json" }).$type<NotificationPrefs>(),
    sidebarCollapsed: integer("sidebar_collapsed", { mode: "boolean" }).notNull().default(false),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: integer("locked_until"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    // Email is unique per tenant, not globally (§6.1).
    uniqueIndex("users_tenant_email_uq").on(table.tenantId, table.email),
    index("users_tenant_role_idx").on(table.tenantId, table.role),
  ],
);

/**
 * Database sessions, not JWTs — so an admin can revoke access and "who is
 * logged in" is queryable (§4.3). 30-day rolling expiry, 90-day hard cap.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    userId: text("user_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    role: text("role").notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: integer("expires_at").notNull(),
    absoluteExpiresAt: integer("absolute_expires_at").notNull(),
    revokedAt: integer("revoked_at"),
    createdAt: integer("created_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_uq").on(table.token),
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

/** Present from day one so Google login needs no migration (§4.3). */
export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: integer("expires_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("accounts_provider_account_uq").on(table.provider, table.providerAccountId)],
);

export const inviteTokens = sqliteTable(
  "invite_tokens",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id").notNull(),
    token: text("token").notNull(),
    role: text("role").notNull(),
    invitedBy: text("invited_by").notNull(),
    expiresAt: integer("expires_at").notNull(),
    acceptedAt: integer("accepted_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("invite_tokens_token_uq").on(table.token),
    index("invite_tokens_user_idx").on(table.userId),
  ],
);
