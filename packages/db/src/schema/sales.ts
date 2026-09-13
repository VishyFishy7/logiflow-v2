import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** Leads — v1 model preserved, plus conversion linkage (§6.1). */
export const leads = sqliteTable(
  "leads",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    company: text("company").notNull(),
    email: text("email"),
    phone: text("phone"),
    source: text("source").notNull(),
    status: text("status").notNull().default("new"),
    assignedTo: text("assigned_to"),
    notes: text("notes"),
    nextFollowUp: integer("next_follow_up"),
    expectedValuePaise: integer("expected_value_paise"),
    convertedClientId: text("converted_client_id"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("leads_tenant_status_idx").on(table.tenantId, table.status),
    index("leads_tenant_assigned_idx").on(table.tenantId, table.assignedTo),
    index("leads_next_follow_up_idx").on(table.tenantId, table.nextFollowUp),
  ],
);

export const leadActivities = sqliteTable(
  "lead_activities",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    leadId: text("lead_id").notNull(),
    kind: text("kind").notNull().default("note"),
    text: text("text").notNull(),
    byUserId: text("by_user_id"),
    byUserName: text("by_user_name"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("lead_activities_lead_idx").on(table.leadId, table.createdAt)],
);

/** Invoices — number from `sequences`, totals computed server-side (§6.1). */
export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    number: text("number").notNull(),
    clientId: text("client_id").notNull(),
    status: text("status").notNull().default("pending"),
    subtotalPaise: integer("subtotal_paise").notNull().default(0),
    taxPaise: integer("tax_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull().default(0),
    currency: text("currency").notNull().default("INR"),
    issueDate: integer("issue_date").notNull(),
    dueDate: integer("due_date").notNull(),
    paidAt: integer("paid_at"),
    notes: text("notes"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("invoices_tenant_number_uq").on(table.tenantId, table.number),
    index("invoices_tenant_status_idx").on(table.tenantId, table.status),
    index("invoices_tenant_due_idx").on(table.tenantId, table.dueDate),
    index("invoices_tenant_client_idx").on(table.tenantId, table.clientId),
  ],
);

/** Invoice↔Shipment is many-to-many through this table (§6.1). */
export const invoiceLines = sqliteTable(
  "invoice_lines",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    invoiceId: text("invoice_id").notNull(),
    shipmentId: text("shipment_id"),
    description: text("description").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    /** Basis points, e.g. 1800 = 18.00%. */
    taxRateBp: integer("tax_rate_bp").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("invoice_lines_invoice_idx").on(table.invoiceId),
    index("invoice_lines_shipment_idx").on(table.shipmentId),
  ],
);
