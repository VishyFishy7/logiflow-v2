import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** Clients — v1 kept this as free text on the shipment; v2 promotes it (§6.1). */
export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    gstin: text("gstin"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    creditTermsDays: integer("credit_terms_days"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("clients_tenant_name_uq").on(table.tenantId, table.name),
    index("clients_tenant_active_idx").on(table.tenantId, table.active),
  ],
);

export const carriers = sqliteTable(
  "carriers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    adapter: text("adapter").notNull().default("mock"),
    trackingUrlTemplate: text("tracking_url_template"),
    /** Secret material lives here in development; production reads a vault ref. */
    webhookSecretRef: text("webhook_secret_ref"),
    webhookSecret: text("webhook_secret"),
    supportsWebhook: integer("supports_webhook", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    priority: integer("priority").notNull().default(50),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("carriers_tenant_code_uq").on(table.tenantId, table.code),
    index("carriers_tenant_active_idx").on(table.tenantId, table.active),
  ],
);
