import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Shipment — the centre of the product (PRD §6.1). Two identifiers live here:
 * `trackingId` (ours, immutable) and `carrierTrackingId` (theirs, maskable).
 */
export const shipments = sqliteTable(
  "shipments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    trackingId: text("tracking_id").notNull(),
    carrierTrackingId: text("carrier_tracking_id"),
    carrierTrackingIdSetAt: integer("carrier_tracking_id_set_at"),
    clientId: text("client_id").notNull(),
    carrierId: text("carrier_id").notNull(),
    referenceNumber: text("reference_number"),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    originPincode: text("origin_pincode"),
    destinationPincode: text("destination_pincode"),
    invoiceNumber: text("invoice_number"),
    packages: integer("packages").notNull().default(1),
    /** Integer grams — dialect-safe, displayed as kg (§6.1). */
    weightGrams: integer("weight_grams").notNull().default(0),
    declaredValuePaise: integer("declared_value_paise"),
    serviceLevel: text("service_level").notNull().default("surface"),
    paymentMode: text("payment_mode").notNull().default("prepaid"),
    status: text("status").notNull().default("pickup"),
    assignedTo: text("assigned_to"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    expectedDelivery: integer("expected_delivery").notNull(),
    deliveredAt: integer("delivered_at"),
    delayReason: text("delay_reason"),
    notes: text("notes"),
    lastSyncedAt: integer("last_synced_at"),
    syncState: text("sync_state").notNull().default("manual"),
    syncFailures: integer("sync_failures").notNull().default(0),
    deletedAt: integer("deleted_at"),
    deletedBy: text("deleted_by"),
  },
  (table) => [
    uniqueIndex("shipments_tenant_tracking_uq").on(table.tenantId, table.trackingId),
    index("shipments_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("shipments_tenant_status_idx").on(table.tenantId, table.status),
    index("shipments_tenant_carrier_idx").on(table.tenantId, table.carrierId),
    index("shipments_tenant_client_idx").on(table.tenantId, table.clientId),
    index("shipments_tenant_assigned_idx").on(table.tenantId, table.assignedTo),
    index("shipments_tenant_carrier_tracking_idx").on(table.tenantId, table.carrierTrackingId),
    index("shipments_deleted_idx").on(table.deletedAt),
  ],
);

/** The timeline (v1's model, preserved — §2.4 / §6.1). */
export const checkpoints = sqliteTable(
  "checkpoints",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    shipmentId: text("shipment_id").notNull(),
    status: text("status").notNull(),
    label: text("label").notNull(),
    location: text("location"),
    note: text("note"),
    delayReason: text("delay_reason"),
    /** Client-assertable. */
    occurredAt: integer("occurred_at").notNull(),
    /** Server-set, immutable. */
    recordedAt: integer("recorded_at").notNull(),
    source: text("source").notNull().default("manual"),
    byUserId: text("by_user_id"),
    byUserName: text("by_user_name"),
    rawStatus: text("raw_status"),
    rawPayload: text("raw_payload", { mode: "json" }).$type<unknown>(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("checkpoints_shipment_occurred_idx").on(table.shipmentId, table.occurredAt),
    index("checkpoints_tenant_idx").on(table.tenantId),
  ],
);
