import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Tenant = the white-label root (PRD §6.1 / §6.3). Brand fields live here, not
 * in a TS module, so reselling the platform is a database row.
 */
export const tenants = sqliteTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    companyName: text("company_name").notNull(),
    productName: text("product_name").notNull(),
    tagline: text("tagline").notNull().default(""),
    trackingPrefix: text("tracking_prefix").notNull(),
    supportEmail: text("support_email").notNull().default(""),
    themePrimary: text("theme_primary").notNull().default("#0ea5e9"),
    themePrimaryDark: text("theme_primary_dark").notNull().default("#38bdf8"),
    themeAccent: text("theme_accent").notNull().default("#0ea5e9"),
    themeSidebarBg: text("theme_sidebar_bg").notNull().default("#fafafa"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    currency: text("currency").notNull().default("INR"),
    plan: text("plan").notNull().default("trial"),
    maskPolicy: text("mask_policy").notNull().default("last2"),
    publicTrackingEnabled: integer("public_tracking_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    delayReasons: text("delay_reasons", { mode: "json" }).$type<string[]>().notNull(),
    leadSources: text("lead_sources", { mode: "json" }).$type<string[]>().notNull(),
    inviteOnly: integer("invite_only", { mode: "boolean" }).notNull().default(false),
    auditRetentionMonths: integer("audit_retention_months").notNull().default(24),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("tenants_slug_uq").on(table.slug)],
);

/** Per-tenant, per-year counters for human invoice numbers (§6.1). */
export const sequences = sqliteTable(
  "sequences",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    key: text("key").notNull(),
    year: integer("year").notNull(),
    value: integer("value").notNull().default(0),
  },
  (table) => [uniqueIndex("sequences_tenant_key_year_uq").on(table.tenantId, table.key, table.year)],
);

/** `Idempotency-Key` replay store, 24h window (§4.5). */
export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    key: text("key").notNull(),
    route: text("route").notNull(),
    requestHash: text("request_hash").notNull(),
    responseBody: text("response_body"),
    statusCode: integer("status_code"),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idempotency_tenant_key_uq").on(table.tenantId, table.key),
    index("idempotency_expires_idx").on(table.expiresAt),
  ],
);

/** Public-tracking rate limiter + enumeration guard (§8.3 rule 6 / §9.8). */
export const rateLimits = sqliteTable(
  "rate_limits",
  {
    id: text("id").primaryKey(),
    bucket: text("bucket").notNull(),
    count: integer("count").notNull().default(0),
    windowStart: integer("window_start").notNull(),
    blockedUntil: integer("blocked_until"),
    failures: integer("failures").notNull().default(0),
  },
  (table) => [uniqueIndex("rate_limits_bucket_uq").on(table.bucket)],
);

export const auditEventsImmutableTrigger = sql`
  CREATE TRIGGER IF NOT EXISTS audit_events_no_update
  BEFORE UPDATE ON audit_events
  BEGIN
    SELECT RAISE(ABORT, 'audit_events is append-only: UPDATE is rejected');
  END;
`;

export const auditEventsImmutableTriggerDelete = sql`
  CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
  BEFORE DELETE ON audit_events
  BEGIN
    SELECT RAISE(ABORT, 'audit_events is append-only: DELETE is rejected');
  END;
`;
