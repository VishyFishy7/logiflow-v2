import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    /** null = broadcast to the tenant (§6.1). */
    userId: text("user_id"),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    shipmentId: text("shipment_id"),
    invoiceId: text("invoice_id"),
    readAt: integer("read_at"),
    channelsSent: text("channels_sent", { mode: "json" }).$type<string[]>().notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("notifications_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("notifications_user_unread_idx").on(table.tenantId, table.userId, table.readAt),
  ],
);

/**
 * AuditEvent — append-only (PRD §9.2). A SQLite trigger rejects UPDATE and
 * DELETE; corrections are new rows. Indexed for the §11.7 queries.
 */
export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    occurredAt: integer("occurred_at").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    actorName: text("actor_name").notNull(),
    actorAvatarUrl: text("actor_avatar_url"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    /** Denormalised so the table renders without joins (§6.1). */
    entityLabel: text("entity_label").notNull(),
    severity: text("severity").notNull().default("info"),
    summary: text("summary").notNull(),
    changes: text("changes", { mode: "json" }).$type<Record<string, { from: unknown; to: unknown }>>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    requestId: text("request_id").notNull(),
    source: text("source").notNull().default("web"),
  },
  (table) => [
    index("audit_tenant_occurred_idx").on(table.tenantId, table.occurredAt),
    index("audit_tenant_actor_idx").on(table.tenantId, table.actorId),
    index("audit_tenant_entity_idx").on(table.tenantId, table.entityType, table.entityId),
    index("audit_tenant_action_idx").on(table.tenantId, table.action),
    index("audit_tenant_severity_idx").on(table.tenantId, table.severity),
  ],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    storageKey: text("storage_key").notNull(),
    uploadedBy: text("uploaded_by"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("attachments_entity_idx").on(table.tenantId, table.entityType, table.entityId)],
);

/** Queued work. `naturalKey` + unique index makes every job idempotent (§9.5). */
export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    type: text("type").notNull(),
    payload: text("payload", { mode: "json" }).$type<unknown>(),
    naturalKey: text("natural_key").notNull(),
    runAt: integer("run_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    status: text("status").notNull().default("queued"),
    lockedAt: integer("locked_at"),
    finishedAt: integer("finished_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("jobs_natural_key_uq").on(table.naturalKey),
    index("jobs_status_run_at_idx").on(table.status, table.runAt),
  ],
);

/** Channel delivery log (email/.eml locally, §9.6). */
export const notificationDeliveries = sqliteTable(
  "notification_deliveries",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    notificationId: text("notification_id").notNull(),
    channel: text("channel").notNull(),
    toAddress: text("to_address"),
    status: text("status").notNull().default("sent"),
    detail: text("detail"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("notification_deliveries_notification_idx").on(table.notificationId)],
);
