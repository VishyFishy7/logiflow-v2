/**
 * Public API surface for @logiflow/db.
 *
 * Re-exports the client, error types, actor, audit, mapping helpers,
 * and key repository/service functions that route handlers need.
 */
export { db, getDb, type Db, type Tx, type Executor } from "./client";
export { ApiError, notFound, validationFailed } from "./errors";
export { type Actor, type AuditActorRef, systemActor, decideScope } from "./actor";
export { recordAudit, diffChanges, type AuditEntry } from "./audit";
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
} from "./mapping";
export * from "./schema/index";
export { exportSnapshot } from "./export-snapshot";

// ── Auth ────────────────────────────────────────────────────────────────────
export { hashPassword, verifyPassword, checkPasswordStrength } from "./services/auth";
export {
  createSession,
  getSession,
  resolveActor,
  buildSessionResponse,
  type SessionResult,
} from "./services/session";
export {
  listNotifications,
  markRead,
  markAllRead,
  createNotification,
  type NotificationRow,
} from "./services/notifications";
export {
  lookupPublicTracking,
  type BrandResolver,
} from "./services/tracking";

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
} from "./repositories/shipments";

export {
  listTeam,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  changeRole,
  type TeamMember,
} from "./repositories/users";

export { listAuditEvents, auditTimelineForEntity, type AuditFacets } from "./repositories/audit";

export {
  listLeads,
  leadDetail as getLead,
  createLead,
  updateLead,
  logLeadActivity as addLeadActivity,
  convertLeadToClient as convertLead,
} from "./repositories/leads";

export {
  listInvoices,
  invoiceDetail as getInvoiceDetail,
  createInvoice,
  updateInvoiceStatus as updateInvoice,
  invoicesCsv as exportInvoicesCsv,
} from "./repositories/invoices";

export {
  listClients,
  createClient,
  updateClient,
  listCarriers,
  createCarrier,
  updateCarrier,
} from "./repositories/partners";

export {
  getTenant,
  getTenantBySlug,
  updateTenantBrand,
  updateTrackingSettings,
  updateDelayReasons,
  updateLeadSources,
  brandPreview,
} from "./repositories/tenant";

export { dashboardStats as getDashboardStats } from "./repositories/stats";
