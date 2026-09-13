/**
 * Roles and permissions — PRD §7.
 *
 * v1's six booleans are replaced by named keys. The UI and the API talk about
 * the same strings; `MATRIX` is the single source of truth and is exercised by
 * the permission test suite (every role × every key).
 */

export const ROLES = [
  "owner",
  "admin",
  "ops_manager",
  "dispatcher",
  "accounts",
  "sales",
  "viewer",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  ops_manager: "Operations Manager",
  dispatcher: "Dispatcher",
  accounts: "Accounts",
  sales: "Sales",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Tenant-wide access including billing and tenant settings.",
  admin: "Everything except plan/billing and tenant deletion.",
  ops_manager: "All shipments and clients, carrier config, audit log read, reports.",
  dispatcher: "Assigned shipments and leads only; can log status.",
  accounts: "Invoices, clients, payment status. Shipments read-only.",
  sales: "Leads and clients only; their clients' shipments read-only.",
  viewer: "Read-only, assigned scope. For auditors and clients' staff.",
};

export const PERMISSIONS = [
  "shipment:create",
  "shipment:read_all",
  "shipment:read_assigned",
  "shipment:update",
  "shipment:log_status",
  "shipment:delete",
  "shipment:assign",
  "tracking:reveal",
  "carrier:manage",
  "client:read",
  "client:manage",
  "invoice:read",
  "invoice:manage",
  "lead:read_all",
  "lead:read_assigned",
  "lead:manage",
  "analytics:view",
  "audit:read",
  "audit:export",
  "team:manage",
  "settings:manage",
  "billing:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * How much of a permission a role holds.
 * - `all`         — across the tenant
 * - `assigned`    — only rows where the actor is the assignee
 * - `own_clients` — only rows belonging to a client the actor owns
 * - `deny`        — not held
 */
export type Grant = "all" | "assigned" | "own_clients" | "deny";

type Matrix = Record<Role, Record<Permission, Grant>>;

const ALL: Record<Permission, Grant> = Object.fromEntries(
  PERMISSIONS.map((key) => [key, "deny"]),
) as Record<Permission, Grant>;

function grants(overrides: Partial<Record<Permission, Grant>>): Record<Permission, Grant> {
  return { ...ALL, ...overrides };
}

export const MATRIX: Matrix = {
  owner: grants(
    Object.fromEntries(PERMISSIONS.map((key) => [key, "all"])) as Partial<Record<Permission, Grant>>,
  ),

  admin: grants(
    Object.fromEntries(
      PERMISSIONS.filter((key) => key !== "billing:manage").map((key) => [key, "all"]),
    ) as Partial<Record<Permission, Grant>>,
  ),

  ops_manager: grants({
    "shipment:create": "all",
    "shipment:read_all": "all",
    "shipment:read_assigned": "all",
    "shipment:update": "all",
    "shipment:log_status": "all",
    "shipment:assign": "all",
    "tracking:reveal": "all",
    "carrier:manage": "all",
    "client:read": "all",
    "client:manage": "all",
    "lead:read_all": "all",
    "lead:read_assigned": "all",
    "lead:manage": "all",
    "analytics:view": "all",
    "audit:read": "all",
    "audit:export": "all",
  }),

  dispatcher: grants({
    "shipment:create": "all",
    "shipment:read_assigned": "all",
    "shipment:update": "assigned",
    "shipment:log_status": "assigned",
    "client:read": "all",
    "lead:read_assigned": "all",
    "lead:manage": "assigned",
    "analytics:view": "all",
  }),

  accounts: grants({
    "shipment:read_all": "all",
    "client:read": "all",
    "client:manage": "all",
    "invoice:read": "all",
    "invoice:manage": "all",
    "analytics:view": "all",
  }),

  sales: grants({
    "shipment:read_all": "own_clients",
    "client:read": "all",
    "client:manage": "all",
    "lead:read_all": "all",
    "lead:read_assigned": "all",
    "lead:manage": "assigned",
    "analytics:view": "all",
  }),

  viewer: grants({
    "shipment:read_assigned": "all",
    "lead:read_assigned": "all",
    "audit:read": "all",
  }),
};

/** The resolved key list sent to the client in `GET /auth/session`. */
export function permissionsFor(role: Role): Permission[] {
  return PERMISSIONS.filter((key) => MATRIX[role][key] !== "deny");
}

export function grantFor(role: Role, permission: Permission): Grant {
  return MATRIX[role]?.[permission] ?? "deny";
}

export function can(role: Role, permission: Permission): boolean {
  return grantFor(role, permission) !== "deny";
}

/**
 * Row-scope decision used by `withAuth({ scope })`. A user with `read_all`
 * sees everything; otherwise the repository filters to their assignments.
 */
export function grantsAll(role: Role, permission: Permission): boolean {
  return grantFor(role, permission) === "all";
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Roles that may be assigned work (used by the assignee pickers). */
export const ASSIGNABLE_ROLES: Role[] = ["owner", "admin", "ops_manager", "dispatcher"];

export function roleRank(role: Role): number {
  return ROLES.indexOf(role);
}
