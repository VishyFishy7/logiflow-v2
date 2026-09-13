/**
 * The route table. One declaration drives three things (§19 #3):
 *  1. the server-side `withAuth` guard,
 *  2. the permission-matrix test (7 roles × every endpoint),
 *  3. the MSW mock handlers, so a mock can never invent a route the server lacks.
 */
import type { Permission } from "@logiflow/shared";
import type { ApiErrorCode } from "./common.js";

export type ScopeMode = "all" | "assigned" | "own_clients";
export type Access = "public" | "auth";

export interface RouteSpec {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** Path template with `:param` segments, relative to /api/v1. */
  path: string;
  access: Access;
  /** Permission required; omitted ⇒ any authenticated user. */
  permission?: Permission;
  /** Row-scoping applied when the actor lacks the tenant-wide grant. */
  scope?: ScopeMode;
  /** Leads shipment ids are resolved from the client (§7.2 `own clients`). */
  description: string;
  audited?: boolean;
}

export const API_ROUTES: RouteSpec[] = [
  // auth
  { method: "POST", path: "/auth/login", access: "public", description: "Sign in with credentials" },
  { method: "POST", path: "/auth/signup", access: "public", description: "Create a tenant + owner account" },
  { method: "POST", path: "/auth/accept-invite", access: "public", description: "Set a password from an invite token" },
  { method: "POST", path: "/auth/logout", access: "auth", audited: true, description: "End the session" },
  { method: "GET", path: "/auth/session", access: "auth", description: "Current user, role, permissions, brand" },
  { method: "PATCH", path: "/auth/profile", access: "auth", audited: true, description: "Update own profile and prefs" },
  { method: "POST", path: "/auth/password", access: "auth", audited: true, description: "Change own password" },
  { method: "GET", path: "/auth/team", access: "auth", permission: "team:manage", description: "Team list" },
  { method: "POST", path: "/auth/team/invite", access: "auth", permission: "team:manage", audited: true, description: "Invite a teammate" },
  { method: "PATCH", path: "/auth/team/:id", access: "auth", permission: "team:manage", audited: true, description: "Change role or deactivate" },

  // shipments
  { method: "GET", path: "/shipments", access: "auth", permission: "shipment:read_assigned", scope: "assigned", description: "List shipments (masked IDs)" },
  { method: "POST", path: "/shipments", access: "auth", permission: "shipment:create", audited: true, description: "Create a shipment" },
  { method: "GET", path: "/shipments/stats", access: "auth", permission: "analytics:view", description: "Shipment aggregates" },
  { method: "GET", path: "/shipments/export", access: "auth", permission: "analytics:view", audited: true, description: "CSV export, filter-aware" },
  { method: "GET", path: "/shipments/:id", access: "auth", permission: "shipment:read_assigned", scope: "assigned", description: "Shipment detail" },
  { method: "PATCH", path: "/shipments/:id", access: "auth", permission: "shipment:update", scope: "assigned", audited: true, description: "Edit fields (diff audited)" },
  { method: "DELETE", path: "/shipments/:id", access: "auth", permission: "shipment:delete", audited: true, description: "Soft delete" },
  { method: "GET", path: "/shipments/:id/checkpoints", access: "auth", permission: "shipment:read_assigned", scope: "assigned", description: "Checkpoint timeline" },
  { method: "POST", path: "/shipments/:id/checkpoints", access: "auth", permission: "shipment:log_status", scope: "assigned", audited: true, description: "Log a checkpoint" },
  { method: "POST", path: "/shipments/:id/tracking/reveal", access: "auth", permission: "tracking:reveal", audited: true, description: "Reveal raw tracking IDs" },
  { method: "POST", path: "/shipments/:id/carrier-booking", access: "auth", permission: "shipment:update", scope: "assigned", audited: true, description: "Book with the carrier adapter" },
  { method: "POST", path: "/shipments/:id/sync", access: "auth", permission: "shipment:update", scope: "assigned", audited: true, description: "Force a carrier sync" },
  { method: "POST", path: "/shipments/bulk/assign", access: "auth", permission: "shipment:assign", audited: true, description: "Bulk assign" },
  { method: "POST", path: "/shipments/bulk/status", access: "auth", permission: "shipment:log_status", scope: "assigned", audited: true, description: "Bulk status log" },

  // clients
  { method: "GET", path: "/clients", access: "auth", permission: "client:read", description: "List clients" },
  { method: "POST", path: "/clients", access: "auth", permission: "client:manage", audited: true, description: "Create a client" },
  { method: "PATCH", path: "/clients/:id", access: "auth", permission: "client:manage", audited: true, description: "Update a client" },

  // carriers
  { method: "GET", path: "/carriers", access: "auth", permission: "client:read", description: "List carriers" },
  { method: "POST", path: "/carriers", access: "auth", permission: "carrier:manage", audited: true, description: "Add a carrier" },
  { method: "PATCH", path: "/carriers/:id", access: "auth", permission: "carrier:manage", audited: true, description: "Update a carrier" },
  { method: "POST", path: "/carriers/:id/rotate-secret", access: "auth", permission: "carrier:manage", audited: true, description: "Rotate the webhook secret" },

  // leads
  { method: "GET", path: "/leads", access: "auth", permission: "lead:read_assigned", scope: "assigned", description: "List leads (scoped)" },
  { method: "POST", path: "/leads", access: "auth", permission: "lead:manage", audited: true, description: "Create a lead" },
  { method: "PATCH", path: "/leads/:id", access: "auth", permission: "lead:manage", scope: "assigned", audited: true, description: "Update a lead / move stage" },
  { method: "POST", path: "/leads/:id/activity", access: "auth", permission: "lead:manage", scope: "assigned", audited: true, description: "Append an activity" },
  { method: "POST", path: "/leads/:id/convert", access: "auth", permission: "client:manage", scope: "assigned", audited: true, description: "Convert to a client" },

  // invoices
  { method: "GET", path: "/invoices", access: "auth", permission: "invoice:read", description: "List invoices" },
  { method: "POST", path: "/invoices", access: "auth", permission: "invoice:manage", audited: true, description: "Create an invoice" },
  { method: "GET", path: "/invoices/export", access: "auth", permission: "invoice:read", audited: true, description: "CSV export" },
  { method: "GET", path: "/invoices/:id", access: "auth", permission: "invoice:read", description: "Invoice detail" },
  { method: "PATCH", path: "/invoices/:id", access: "auth", permission: "invoice:manage", audited: true, description: "Update status / lines" },

  // audit
  { method: "GET", path: "/audit", access: "auth", permission: "audit:read", description: "Paged audit log" },
  { method: "GET", path: "/audit/export", access: "auth", permission: "audit:export", audited: true, description: "CSV export" },
  { method: "GET", path: "/audit/export.json", access: "auth", permission: "audit:export", audited: true, description: "JSON Lines export" },

  // notifications
  { method: "GET", path: "/notifications", access: "auth", description: "List notifications" },
  { method: "POST", path: "/notifications/read-all", access: "auth", description: "Mark all read" },
  { method: "POST", path: "/notifications/:id/read", access: "auth", description: "Mark one read" },

  // settings
  { method: "GET", path: "/settings", access: "auth", permission: "settings:manage", description: "Tenant settings" },
  { method: "PATCH", path: "/settings/brand", access: "auth", permission: "settings:manage", audited: true, description: "Update brand" },
  { method: "PATCH", path: "/settings/tracking", access: "auth", permission: "settings:manage", audited: true, description: "Update tracking settings" },
  { method: "PATCH", path: "/settings/vocabulary", access: "auth", permission: "settings:manage", audited: true, description: "Update vocabularies" },
  { method: "PATCH", path: "/settings/tenant", access: "auth", permission: "billing:manage", audited: true, description: "Timezone / currency" },
  { method: "GET", path: "/settings/export", access: "auth", permission: "settings:manage", audited: true, description: "Portable JSON snapshot" },

  // public
  { method: "GET", path: "/track/:trackingId", access: "public", description: "Public tracking lookup (rate-limited)" },
  { method: "POST", path: "/webhooks/carriers/:code", access: "public", description: "Carrier webhook (HMAC)" },
  { method: "GET", path: "/health", access: "public", description: "Liveness + DB check" },
];

/** Error codes a route is documented to return, for the OpenAPI export. */
export const ROUTE_ERRORS: Partial<Record<string, ApiErrorCode[]>> = {
  "POST /shipments": ["VALIDATION_FAILED", "CLIENT_NOT_FOUND", "CARRIER_NOT_FOUND"],
  "PATCH /shipments/:id": ["VALIDATION_FAILED", "SHIPMENT_NOT_FOUND", "FORBIDDEN"],
  "POST /shipments/:id/checkpoints": [
    "VALIDATION_FAILED",
    "DELAY_REASON_REQUIRED",
    "INVALID_STATUS_TRANSITION",
    "SHIPMENT_NOT_FOUND",
  ],
  "POST /shipments/:id/tracking/reveal": ["FORBIDDEN", "SHIPMENT_NOT_FOUND"],
  "PATCH /auth/team/:id": ["LAST_OWNER_PROTECTED", "USER_NOT_FOUND", "EMAIL_ALREADY_EXISTS"],
  "POST /auth/login": ["INVALID_CREDENTIALS", "ACCOUNT_INACTIVE", "RATE_LIMITED"],
  "GET /track/:trackingId": ["NOT_FOUND", "RATE_LIMITED"],
  "POST /webhooks/carriers/:code": ["WEBHOOK_SIGNATURE_INVALID", "WEBHOOK_PAYLOAD_INVALID"],
};

export function routeKey(method: string, path: string): string {
  return `${method} ${path}`;
}

export function findRoute(method: string, pathname: string): RouteSpec | undefined {
  const segments = pathname.split("/").filter(Boolean);
  return API_ROUTES.find((route) => {
    if (route.method !== method) return false;
    const spec = route.path.split("/").filter(Boolean);
    if (spec.length !== segments.length) return false;
    return spec.every((part, i) => part.startsWith(":") || part === segments[i]);
  });
}
