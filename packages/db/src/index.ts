/**
 * Public API surface for @logiflow/db.
 *
 * Re-exports the client, error types, actor, audit, mapping helpers,
 * and key repository/service functions that route handlers need.
 */
export { db, getDb, type Db, type Tx, type Executor } from "./client.js";
export { ApiError, notFound, validationFailed } from "./errors.js";
export { type Actor, type AuditActorRef, systemActor, decideScope } from "./actor.js";
export { recordAudit, diffChanges, type AuditEntry } from "./audit.js";
export {
  envelope,
  internalIdEnvelope,
  carrierIdEnvelope,
  rowToShipment,
  rowToCheckpoint,
  rowToClient,
  rowToCarrier,
  rowToLead,
  rowToLeadActivity,
  rowToInvoice,
  rowToNotification,
  rowToAuditEvent,
  type ShipmentSideData,
} from "./mapping.js";
export * from "./schema/index.js";
export { exportSnapshot } from "./export-snapshot.js";

// ── Auth ────────────────────────────────────────────────────────────────────
export { hashPassword, verifyPassword, checkPasswordStrength } from "./services/auth.js";
export {
  createSession,
  getSession,
  resolveActor,
  buildSessionResponse,
  type SessionResult,
} from "./services/session.js";
export {
  listNotifications,
  markRead,
  markAllRead,
  createNotification,
  type NotificationRow,
} from "./services/notifications.js";
export {
  lookupPublicTracking,
  type BrandResolver,
} from "./services/tracking.js";

// ── Repositories ────────────────────────────────────────────────────────────
export {
  listShipments,
  getShipment,
  getShipmentDetail,
  createShipment,
  updateShipment,
  softDeleteShipment,
  logStatus,
  listCheckpoints,
  bulkAssign,
  bulkStatus,
  shipmentsCsv,
  type ShipmentFilterValues,
} from "./repositories/shipments.js";

export {
  listTeam,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  changeRole,
  type TeamMember,
} from "./repositories/users.js";

export { listAuditEvents, auditTimelineForEntity, type AuditFacets } from "./repositories/audit.js";

export {
  listLeads,
  leadDetail as getLead,
  createLead,
  updateLead,
  logLeadActivity as addLeadActivity,
  convertLeadToClient as convertLead,
} from "./repositories/leads.js";

export {
  listInvoices,
  invoiceDetail as getInvoiceDetail,
  createInvoice,
  updateInvoiceStatus as updateInvoice,
  invoicesCsv as exportInvoicesCsv,
} from "./repositories/invoices.js";

export {
  listClients,
  createClient,
  updateClient,
  listCarriers,
  createCarrier,
  updateCarrier,
} from "./repositories/partners.js";

export {
  getTenant,
  getTenantBySlug,
  updateTenantBrand,
  updateTrackingSettings,
  updateDelayReasons,
  updateLeadSources,
  brandPreview,
} from "./repositories/tenant.js";

export { dashboardStats as getDashboardStats } from "./repositories/stats.js";
