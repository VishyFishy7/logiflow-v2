/**
 * Lazy DB proxy — all route handlers import from here instead of @logiflow/db.
 * This avoids Turbopack bundling the native better-sqlite3 at module load time.
 * The actual DB is loaded via require() on first access.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mod: any = null;

function loadDb() {
  if (!_mod) {
    // require() at runtime so Turbopack doesn't try to bundle the native dep
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _mod = require("@logiflow/db");
  }
  return _mod;
}

/** Lazy getter — returns the actual getDb() from @logiflow/db */
export function getDb() {
  return loadDb().getDb();
}

// Lazy table object proxies — these emulate drizzle table references
// so route handlers can write db.select().from(users) as before.
function lazyTable(name: string) {
  return new Proxy({} as any, {
    get(_target, prop, _receiver) {
      return (loadDb()[name] as any)[prop];
    },
  });
}

export const users = lazyTable("users");
export const tenants = lazyTable("tenants");
export const shipments = lazyTable("shipments");

// Re-export all the things route handlers need, as lazy function wrappers
export const hashPassword = (...args: unknown[]) => loadDb().hashPassword(...args);
export const verifyPassword = (...args: unknown[]) => loadDb().verifyPassword(...args);
export const listShipments = (...args: unknown[]) => loadDb().listShipments(...args);
export const getShipmentDetail = (...args: unknown[]) => loadDb().getShipmentDetail(...args);
export const createShipment = (...args: unknown[]) => loadDb().createShipment(...args);
export const updateShipment = (...args: unknown[]) => loadDb().updateShipment(...args);
export const softDeleteShipment = (...args: unknown[]) => loadDb().softDeleteShipment(...args);
export const logStatus = (...args: unknown[]) => loadDb().logStatus(...args);
export const listCheckpoints = (...args: unknown[]) => loadDb().listCheckpoints(...args);
export const bulkAssign = (...args: unknown[]) => loadDb().bulkAssign(...args);
export const bulkStatus = (...args: unknown[]) => loadDb().bulkStatus(...args);
export const shipmentsCsv = (...args: unknown[]) => loadDb().shipmentsCsv(...args);
export const listTeam = (...args: unknown[]) => loadDb().listTeam(...args);
export const createUser = (...args: unknown[]) => loadDb().createUser(...args);
export const deactivateUser = (...args: unknown[]) => loadDb().deactivateUser(...args);
export const changeRole = (...args: unknown[]) => loadDb().changeRole(...args);
export const listAuditEvents = (...args: unknown[]) => loadDb().listAuditEvents(...args);
export const listLeads = (...args: unknown[]) => loadDb().listLeads(...args);
export const createLead = (...args: unknown[]) => loadDb().createLead(...args);
export const updateLead = (...args: unknown[]) => loadDb().updateLead(...args);
export const addLeadActivity = (...args: unknown[]) => loadDb().logLeadActivity(...args);
export const convertLead = (...args: unknown[]) => loadDb().convertLeadToClient(...args);
export const listInvoices = (...args: unknown[]) => loadDb().listInvoices(...args);
export const getInvoiceDetail = (...args: unknown[]) => loadDb().invoiceDetail(...args);
export const createInvoice = (...args: unknown[]) => loadDb().createInvoice(...args);
export const updateInvoice = (...args: unknown[]) => loadDb().updateInvoiceStatus(...args);
export const listClients = (...args: unknown[]) => loadDb().listClients(...args);
export const createClient = (...args: unknown[]) => loadDb().createClient(...args);
export const updateClient = (...args: unknown[]) => loadDb().updateClient(...args);
export const listCarriers = (...args: unknown[]) => loadDb().listCarriers(...args);
export const createCarrier = (...args: unknown[]) => loadDb().createCarrier(...args);
export const updateCarrier = (...args: unknown[]) => loadDb().updateCarrier(...args);
export const getTenant = (...args: unknown[]) => loadDb().getTenant(...args);
export const updateTenantBrand = (...args: unknown[]) => loadDb().updateTenantBrand(...args);
export const updateTrackingSettings = (...args: unknown[]) => loadDb().updateTrackingSettings(...args);
export const updateDelayReasons = (...args: unknown[]) => loadDb().updateDelayReasons(...args);
export const updateLeadSources = (...args: unknown[]) => loadDb().updateLeadSources(...args);
export const exportSnapshot = (...args: unknown[]) => loadDb().exportSnapshot(...args);
export const listNotifications = (...args: unknown[]) => loadDb().listNotifications(...args);
export const markRead = (...args: unknown[]) => loadDb().markRead(...args);
export const markAllRead = (...args: unknown[]) => loadDb().markAllRead(...args);
export const lookupPublicTracking = (...args: unknown[]) => loadDb().lookupPublicTracking(...args);
export const recordAudit = (...args: unknown[]) => loadDb().recordAudit(...args);
export const internalIdEnvelope = (...args: unknown[]) => loadDb().internalIdEnvelope(...args);
export const carrierIdEnvelope = (...args: unknown[]) => loadDb().carrierIdEnvelope(...args);
export const buildSessionResponse = (...args: unknown[]) => loadDb().buildSessionResponse(...args);

// Re-export types
export type Actor = any;
export type BrandResolver = any;
