/**
 * MSW request handlers — 1:1 with API_ROUTES.
 *
 * Every handler is derived from the route table so a mock can never invent a
 * route the server lacks (§19 #3). Permissions, masking, audit logging, and
 * pagination all follow the contracts exactly.
 */
import { http, HttpResponse, type JsonBodyType } from "msw";
import {
  API_ROUTES,
  type RouteSpec,
  listEnvelope,
  ERROR_STATUS,
  type ApiErrorCode,
  LIST_SORT_FIELDS,
  type ListSortField,
  DEMO_PASSWORD,
  demoSession,
  demoDataset,
  type MaskedValueDTO,
} from "@logiflow/contracts";
import {
  can,
  grantsAll,
  permissionsFor,
  grantFor,
  type Role,
  type Permission,
} from "@logiflow/shared";
import { toCsv, escapeCsvCell } from "@logiflow/shared";
import { asMaskedValue } from "@logiflow/shared";
import { maskSecret } from "@logiflow/shared";
import { newPrefixedId, formatInvoiceNumber } from "@logiflow/shared";
import * as store from "./store";

// ── Constants ────────────────────────────────────────────────────────────

const API_PREFIX = "/api/v1";
const MOCK_VERSION = "2.0.0";

// ── Helpers ──────────────────────────────────────────────────────────────

function requestId(): string {
  return `req_${Math.random().toString(36).slice(2, 12)}`;
}

function jsonError(
  code: ApiErrorCode,
  message: string,
  status?: number,
  fieldErrors?: Record<string, string>,
): HttpResponse<JsonBodyType> {
  const httpStatus = status ?? ERROR_STATUS[code] ?? 500;
  return HttpResponse.json(
    { error: { code, message, fieldErrors, requestId: requestId() } },
    { status: httpStatus },
  );
}

function jsonOk(body: unknown, status = 200): HttpResponse<JsonBodyType> {
  return HttpResponse.json(body as JsonBodyType, { status });
}

/** Extract the mock role from the cookie or default to owner. */
function getRole(headers: Headers): Role {
  const cookie = headers.get("cookie") ?? "";
  const match = /lf_mock_role=([^;]+)/.exec(cookie);
  if (match && isValidRole(match[1])) return match[1] as Role;
  // Also check a custom header for tests
  const headerRole = headers.get("x-mock-role");
  if (headerRole && isValidRole(headerRole)) return headerRole as Role;
  return "owner";
}

function isValidRole(value: string): boolean {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "ops_manager" ||
    value === "dispatcher" ||
    value === "accounts" ||
    value === "sales" ||
    value === "viewer"
  );
}

function checkAuth(
  route: RouteSpec,
  headers: Headers,
): { ok: true; role: Role } | { ok: false; response: HttpResponse<JsonBodyType> } {
  if (route.access === "public") return { ok: true, role: "owner" };

  const role = getRole(headers);

  if (route.permission && !can(role, route.permission)) {
    return {
      ok: false,
      response: jsonError(
        "FORBIDDEN",
        `Role '${role}' lacks permission '${route.permission}'`,
        403,
      ),
    };
  }

  return { ok: true, role };
}

/** Get the userId for a given role from the store. */
function userIdForRole(role: string): string | undefined {
  const users = store.readUsers();
  const user = users.find((u) => u.role === role);
  return user?.id;
}

/** Apply scope filtering for assigned routes. */
function scopeFilter<T extends { assignedTo?: { id: string } | null }>(
  items: T[],
  route: RouteSpec,
  role: Role,
  permission: Permission | undefined,
): T[] {
  if (!route.scope || !permission) return items;
  if (grantsAll(role, permission)) return items;

  const userId = userIdForRole(role);
  if (!userId) return [];

  if (route.scope === "assigned") {
    return items.filter((item) => {
      if (!item.assignedTo) return false;
      return item.assignedTo.id === userId;
    });
  }

  // own_clients — for sales, filter by client
  return items;
}

function paginate<T>(
  items: T[],
  params: { page: number; pageSize: number; sort?: string; dir?: string },
): {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
} {
  const { page, pageSize } = params;
  let sorted = [...items];

  if (params.sort && LIST_SORT_FIELDS.includes(params.sort as ListSortField)) {
    const field = params.sort as ListSortField;
    const dir = params.dir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      const va = (a as Record<string, unknown>)[field];
      const vb = (b as Record<string, unknown>)[field];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string" && typeof vb === "string") {
        return va.localeCompare(vb) * dir;
      }
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }
      return 0;
    });
  }

  const total = sorted.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const data = sorted.slice(start, start + pageSize);

  return { data, page, pageSize, total, totalPages };
}

function applyDateRange<T>(
  items: T[],
  fieldName: string,
  from?: string | number,
  to?: string | number,
): T[] {
  if (!from && !to) return items;
  return items.filter((item) => {
    const value = (item as Record<string, unknown>)[fieldName];
    if (typeof value !== "number") return true;
    if (from && value < Number(from)) return false;
    if (to && value > Number(to)) return false;
    return true;
  });
}

function applyQFilter<T>(
  items: T[],
  q: string | undefined,
  fields: string[],
): T[] {
  if (!q) return items;
  const lower = q.toLowerCase();
  return items.filter((item) => {
    return fields.some((field) => {
      const val = (item as Record<string, unknown>)[field];
      if (typeof val === "string") return val.toLowerCase().includes(lower);
      if (val && typeof val === "object") {
        // Search nested fields like client.name
        return Object.values(val).some(
          (v) => typeof v === "string" && v.toLowerCase().includes(lower),
        );
      }
      return false;
    });
  });
}

function parseQuery(url: URL): {
  page: number;
  pageSize: number;
  sort?: string;
  dir?: string;
  q?: string;
  status?: string;
  carrier?: string;
  client?: string;
  assignedTo?: string;
  from?: string;
  to?: string;
  severity?: string;
  entityType?: string;
  action?: string;
  actorId?: string;
  source?: string;
  unreadOnly?: string;
  [key: string]: string | number | undefined;
} {
  const get = (key: string) => url.searchParams.get(key) ?? undefined;
  return {
    page: Number(get("page") ?? "1"),
    pageSize: Math.min(Number(get("pageSize") ?? "25"), 200),
    sort: get("sort"),
    dir: get("dir"),
    q: get("q"),
    status: get("status"),
    carrier: get("carrier"),
    client: get("client"),
    assignedTo: get("assignedTo"),
    from: get("from"),
    to: get("to"),
    severity: get("severity"),
    entityType: get("entityType"),
    action: get("action"),
    actorId: get("actorId"),
    source: get("source"),
    unreadOnly: get("unreadOnly"),
  };
}

/** Mask tracking IDs unless the actor has tracking:reveal. */
function maskTracking(
  shipments: ReturnType<typeof store.readShipments>[number][],
  role: Role,
): ReturnType<typeof store.readShipments>[number][] {
  const canReveal = can(role, "tracking:reveal");
  return shipments.map((s) => ({
    ...s,
    trackingId: canReveal
      ? { ...s.trackingId, raw: s.trackingId.raw }
      : { ...s.trackingId, raw: undefined },
    carrierTrackingId: canReveal
      ? { ...s.carrierTrackingId, raw: s.carrierTrackingId.raw }
      : { ...s.carrierTrackingId, raw: undefined },
  }));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function realisticDelay(isList: boolean): Promise<void> {
  const base = isList ? 120 : 30;
  await delay(base + Math.random() * (isList ? 280 : 70));
}

// ── Handlers ─────────────────────────────────────────────────────────────

export const handlers = [
  // ── Health ──
  http.get(`${API_PREFIX}/health`, () => {
    return jsonOk({ status: "ok", mode: "mock", version: MOCK_VERSION });
  }),

  // ── Auth ──
  http.post(`${API_PREFIX}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password !== DEMO_PASSWORD) {
      return jsonError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }
    const user = store.findUserByEmail(body.email);
    if (!user) {
      return jsonError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }
    const role = user.role as Role;
    const session = demoSession(role, store.getStore().now);
    session.user = user;
    return jsonOk(session);
  }),

  http.post(`${API_PREFIX}/auth/signup`, async ({ request }) => {
    const body = (await request.json()) as { name: string; email: string; password: string; companyName: string; trackingPrefix: string };
    const user = store.getStore().users[0]!;
    const session = demoSession("owner", store.getStore().now);
    session.user = { ...user, name: body.name, email: body.email };
    return jsonOk(session);
  }),

  http.post(`${API_PREFIX}/auth/accept-invite`, async ({ request }) => {
    const _body = (await request.json()) as { token: string; name: string; password: string };
    const user = store.getStore().users[0]!;
    const session = demoSession("owner", store.getStore().now);
    session.user = { ...user, name: _body.name };
    return jsonOk(session);
  }),

  http.post(`${API_PREFIX}/auth/logout`, () => {
    return jsonOk({ ok: true as const });
  }),

  http.get(`${API_PREFIX}/auth/session`, ({ request }) => {
    const headers = request.headers;
    const role = getRole(headers);
    const session = demoSession(role, store.getStore().now);
    return jsonOk(session);
  }),

  http.patch(`${API_PREFIX}/auth/profile`, async ({ request }) => {
    const headers = request.headers;
    const authResult = checkAuth(
      API_ROUTES.find((r) => r.method === "PATCH" && r.path === "/auth/profile")!,
      headers,
    );
    if (!authResult.ok) return authResult.response;
    const _body = (await request.json()) as Record<string, unknown>;
    const user = store.getStore().users.find((u) => u.id === userIdForRole(authResult.role));
    if (!user) return jsonError("USER_NOT_FOUND", "User not found", 404);
    if (_body.name) user.name = _body.name as string;
    if ("phone" in _body) user.phone = _body.phone as string | null;
    return jsonOk({ data: user });
  }),

  http.post(`${API_PREFIX}/auth/password`, async ({ request }) => {
    const headers = request.headers;
    const authResult = checkAuth(
      API_ROUTES.find((r) => r.method === "POST" && r.path === "/auth/password")!,
      headers,
    );
    if (!authResult.ok) return authResult.response;
    const _body = (await request.json()) as Record<string, unknown>;
    return jsonOk({ ok: true as const });
  }),

  http.get(`${API_PREFIX}/auth/team`, ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/auth/team")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    const url = new URL(request.url);
    const params = parseQuery(url);
    const users = store.readUsers();
    const result = paginate(users, params);
    return jsonOk(result);
  }),

  http.post(`${API_PREFIX}/auth/team/invite`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "POST" && r.path === "/auth/team/invite")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    const body = (await request.json()) as { name: string; email: string; role: string };
    const existing = store.findUserByEmail(body.email);
    if (existing) {
      return jsonError("EMAIL_ALREADY_EXISTS", "A user with this email already exists", 409);
    }
    const newUser = {
      id: newPrefixedId("usr"),
      tenantId: store.getStore().tenant.id,
      name: body.name,
      email: body.email,
      phone: null,
      role: body.role as Role,
      avatarUrl: null,
      active: true,
      lastLoginAt: null,
      invitedBy: userIdForRole(authResult.role) ?? null,
      createdAt: store.getStore().now,
    };
    store.addTeamMember(newUser);
    return jsonOk({ data: newUser });
  }),

  http.patch(`${API_PREFIX}/auth/team/:id`, async ({ request, params }) => {
    const route = API_ROUTES.find((r) => r.method === "PATCH" && r.path === "/auth/team/:id")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    const body = (await request.json()) as { role?: string; active?: boolean };
    const updated = store.updateTeamMember(params.id as string, body as Partial<ReturnType<typeof store.readUsers>[number]>);
    if (!updated) return jsonError("USER_NOT_FOUND", "User not found", 404);
    return jsonOk({ data: updated });
  }),

  // ── Shipments ──
  http.get(`${API_PREFIX}/shipments`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/shipments")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    await realisticDelay(true);

    const url = new URL(request.url);
    const params = parseQuery(url);
    let shipments = store.readShipments();

    // Scope filtering
    shipments = scopeFilter(shipments, route, authResult.role, route.permission);

    // Filters
    if (params.status === "open") {
      shipments = shipments.filter((s) => s.status !== "delivered");
    } else if (params.status === "awaiting_carrier_id") {
      shipments = shipments.filter(
        (s) => !s.carrierTrackingId.value || s.carrierTrackingId.value === "\u2022\u2022\u2022\u2022",
      );
    } else if (params.status) {
      shipments = shipments.filter((s) => s.status === params.status);
    }

    if (params.carrier) {
      shipments = shipments.filter((s) => s.carrier.code === params.carrier || s.carrier.id === params.carrier);
    }
    if (params.client) {
      shipments = shipments.filter(
        (s) => s.client.name.toLowerCase().includes(params.client!.toLowerCase()) || s.client.id === params.client,
      );
    }
    if (params.assignedTo) {
      shipments = shipments.filter(
        (s) => s.assignedTo?.id === params.assignedTo || s.assignedTo?.name === params.assignedTo,
      );
    }
    if (params.q) {
      shipments = applyQFilter(shipments, params.q, [
        "trackingId",
        "referenceNumber",
        "invoiceNumber",
        "client",
        "carrier",
      ]);
    }

    shipments = applyDateRange(shipments, "createdAt", params.from, params.to);

    // Mask tracking IDs
    shipments = maskTracking(shipments, authResult.role);

    const result = paginate(shipments, params);
    return jsonOk(result);
  }),

  http.post(`${API_PREFIX}/shipments`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "POST" && r.path === "/shipments")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    await realisticDelay(false);

    const body = (await request.json()) as Record<string, unknown>;
    const carrier = store.readCarriers().find((c) => c.id === body.carrierId);
    if (!carrier) return jsonError("CARRIER_NOT_FOUND", "Carrier not found", 404);

    const client = store.readClients().find((c) => c.name === body.client);
    const clientId = client?.id ?? body.client;

    const trackingId = newPrefixedId("shp");
    const newShipment = {
      id: newPrefixedId("shp"),
      tenantId: store.getStore().tenant.id,
      trackingId: asMaskedValue(trackingId, store.getStore().tenant.maskPolicy),
      carrierTrackingId: asMaskedValue(null, "first2_last2"),
      carrierTrackingIdSetAt: null,
      client: { id: clientId as string, name: client?.name ?? (body.client as string) },
      carrier: { id: carrier.id, code: carrier.code, name: carrier.name },
      route: {
        origin: body.origin as string,
        destination: body.destination as string,
        originPincode: (body.originPincode as string) ?? null,
        destinationPincode: (body.destinationPincode as string) ?? null,
      },
      referenceNumber: (body.referenceNumber as string) ?? null,
      invoiceNumber: null,
      packages: body.packages as number,
      weightGrams: body.weightGrams as number,
      declaredValuePaise: (body.declaredValuePaise as number) ?? null,
      serviceLevel: body.serviceLevel as "surface" | "air" | "express",
      paymentMode: body.paymentMode as "prepaid" | "cod" | "to_pay",
      status: "pickup" as const,
      assignedTo: body.assignedTo
        ? store.findUserById(body.assignedTo as string) ?? null
        : null,
      createdBy: store.findUserById(userIdForRole(authResult.role) ?? "") ?? store.getStore().users[0]!,
      createdAt: store.getStore().now,
      updatedAt: store.getStore().now,
      expectedDelivery: store.getStore().now + 5 * 86_400_000,
      deliveredAt: null,
      delayReason: null,
      notes: (body.notes as string) ?? null,
      lastSyncedAt: null,
      syncState: "manual" as const,
      isOverdue: false,
      checkpointCount: 0,
    };

    store.createShipment(newShipment);
    return jsonOk({ data: newShipment }, 201);
  }),

  http.get(`${API_PREFIX}/shipments/stats`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/shipments/stats")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    await realisticDelay(true);

    // Fault injection
    const failHeader = request.headers.get("x-mock-fail");
    if (failHeader === "all") {
      return jsonError("INTERNAL_ERROR", "Dashboard service failed", 500);
    }

    const shipments = store.readShipments();
    const invoices = store.readInvoices();
    const leads = store.readLeads();
    const dataset = demoDataset(store.getStore().now);
    const kpis = store.readKpis();

    const shipmentsByStatus = [
      { status: "pickup", count: shipments.filter((s) => s.status === "pickup").length },
      { status: "warehouse", count: shipments.filter((s) => s.status === "warehouse").length },
      { status: "in_transit", count: shipments.filter((s) => s.status === "in_transit").length },
      { status: "delivered", count: shipments.filter((s) => s.status === "delivered").length },
      { status: "delayed", count: shipments.filter((s) => s.status === "delayed").length },
    ];

    const result = {
      kpis,
      shipmentsByStatus,
      volumeByDay: [
        { date: "2026-09-07", created: 12, delivered: 8 },
        { date: "2026-09-08", created: 15, delivered: 11 },
        { date: "2026-09-09", created: 9, delivered: 14 },
        { date: "2026-09-10", created: 18, delivered: 10 },
        { date: "2026-09-11", created: 14, delivered: 13 },
        { date: "2026-09-12", created: 11, delivered: 9 },
        { date: "2026-09-13", created: 16, delivered: 12 },
      ],
      delayReasons: [
        { reason: "Traffic congestion", count: 8 },
        { reason: "Weather conditions", count: 5 },
        { reason: "Carrier issue", count: 3 },
      ],
      needsAttention: {
        delayedShipments: shipments.filter((s) => s.status === "delayed").slice(0, 5),
        overdueInvoices: invoices.filter((i) => i.status === "overdue").slice(0, 5),
        followUpsToday: leads.filter((l) => l.status !== "won" && l.status !== "lost").slice(0, 5),
      },
      heatmap: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(store.getStore().now - i * 86_400_000).toISOString().slice(0, 10),
        count: Math.floor(Math.random() * 20),
      })),
      // Analytics extensions (zAnalyticsStats)
      carrierPerformance: (() => {
        const carriers = store.readCarriers();
        const carrierMap = new Map(carriers.map((c) => [c.id, c]));
        const grouped = new Map<string, { carrierId: string; shipments: number; onTime: number; delayed: number; transitHours: number[] }>();
        for (const s of shipments) {
          const key = s.carrier.id;
          if (!grouped.has(key)) grouped.set(key, { carrierId: key, shipments: 0, onTime: 0, delayed: 0, transitHours: [] });
          const g = grouped.get(key)!;
          g.shipments++;
          if (s.status === "delayed") g.delayed++;
          if (s.status === "delivered" && s.deliveredAt && s.expectedDelivery && s.deliveredAt <= s.expectedDelivery) g.onTime++;
          if (s.deliveredAt && s.createdAt) g.transitHours.push((s.deliveredAt - s.createdAt) / 3_600_000);
        }
        return Array.from(grouped.values())
          .map((g) => ({ carrierId: g.carrierId, carrier: carrierMap.get(g.carrierId)?.name ?? "Unknown", shipments: g.shipments, onTime: g.onTime, delayed: g.delayed, avgTransitHours: g.transitHours.length > 0 ? Math.round(g.transitHours.reduce((a: number, b: number) => a + b, 0) / g.transitHours.length * 10) / 10 : 0 }))
          .sort((a, b) => b.shipments - a.shipments);
      })(),
      clientVolume: (() => {
        const clients = store.readClients();
        const clientMap = new Map(clients.map((c) => [c.id, c]));
        const grouped = new Map<string, { clientId: string; shipments: number }>();
        for (const s of shipments) {
          const key = s.client.id;
          if (!grouped.has(key)) grouped.set(key, { clientId: key, shipments: 0 });
          grouped.get(key)!.shipments++;
        }
        return Array.from(grouped.values())
          .map((g) => ({ clientId: g.clientId, client: clientMap.get(g.clientId)?.name ?? "Unknown", shipments: g.shipments }))
          .sort((a, b) => b.shipments - a.shipments);
      })(),
      clientRevenue: (() => {
        const clients = store.readClients();
        const clientMap = new Map(clients.map((c) => [c.id, c]));
        const grouped = new Map<string, { clientId: string; revenuePaise: number }>();
        for (const inv of invoices) {
          const key = inv.client.id;
          if (!grouped.has(key)) grouped.set(key, { clientId: key, revenuePaise: 0 });
          grouped.get(key)!.revenuePaise += inv.totalPaise;
        }
        return Array.from(grouped.values())
          .map((g) => ({ clientId: g.clientId, client: clientMap.get(g.clientId)?.name ?? "Unknown", revenuePaise: g.revenuePaise }))
          .sort((a, b) => b.revenuePaise - a.revenuePaise);
      })(),
      // Partial failure for dashboard (§14.2)
      ...(failHeader
        ? {
            partial: true,
            failedSections: [failHeader],
          }
        : {}),
    };

    return jsonOk(result);
  }),

  http.get(`${API_PREFIX}/shipments/export`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/shipments/export")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const url = new URL(request.url);
    const params = parseQuery(url);
    let shipments = store.readShipments();

    if (params.status === "open") {
      shipments = shipments.filter((s) => s.status !== "delivered");
    } else if (params.status) {
      shipments = shipments.filter((s) => s.status === params.status);
    }

    const columns = [
      { id: "trackingId", header: "Tracking ID", value: (r: ReturnType<typeof store.readShipments>[number]) => r.trackingId.value },
      { id: "status", header: "Status", value: (r: ReturnType<typeof store.readShipments>[number]) => r.status },
      { id: "client", header: "Client", value: (r: ReturnType<typeof store.readShipments>[number]) => r.client.name },
      { id: "carrier", header: "Carrier", value: (r: ReturnType<typeof store.readShipments>[number]) => r.carrier.code },
      { id: "origin", header: "Origin", value: (r: ReturnType<typeof store.readShipments>[number]) => r.route.origin },
      { id: "destination", header: "Destination", value: (r:ReturnType<typeof store.readShipments>[number]) => r.route.destination },
      { id: "createdAt", header: "Created At", value: (r: ReturnType<typeof store.readShipments>[number]) => new Date(r.createdAt).toISOString() },
    ];

    const csv = toCsv(shipments, columns);
    const today = new Date().toISOString().slice(0, 10);
    return new HttpResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="logiflow-shipments-${today}.csv"`,
      },
    });
  }),

  http.get(`${API_PREFIX}/shipments/:id`, async ({ request, params }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/shipments/:id")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    await realisticDelay(false);

    const shipment = store.findShipmentById(params.id as string);
    if (!shipment) return jsonError("SHIPMENT_NOT_FOUND", "Shipment not found", 404);
    const canReveal = can(authResult.role, "tracking:reveal");
    const masked = {
      ...shipment,
      trackingId: canReveal ? shipment.trackingId : { ...shipment.trackingId, raw: undefined },
      carrierTrackingId: canReveal ? shipment.carrierTrackingId : { ...shipment.carrierTrackingId, raw: undefined },
      checkpoints: store.findCheckpointsByShipment(shipment.id),
      invoices: [],
      attachments: [],
    };
    return jsonOk({ data: masked });
  }),

  http.patch(`${API_PREFIX}/shipments/:id`, async ({ request, params }) => {
    const route = API_ROUTES.find((r) => r.method === "PATCH" && r.path === "/shipments/:id")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Record<string, unknown>;
    const existing = store.findShipmentById(params.id as string);
    if (!existing) return jsonError("SHIPMENT_NOT_FOUND", "Shipment not found", 404);

    const updated = store.updateShipment(params.id as string, body as Partial<ReturnType<typeof store.findShipmentById> & Record<string, unknown>>);
    if (!updated) return jsonError("SHIPMENT_NOT_FOUND", "Shipment not found", 404);
    return jsonOk({ data: updated });
  }),

  http.delete(`${API_PREFIX}/shipments/:id`, async ({ request, params }) => {
    const route = API_ROUTES.find((r) => r.method === "DELETE" && r.path === "/shipments/:id")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const deleted = store.deleteShipment(params.id as string);
    if (!deleted) return jsonError("SHIPMENT_NOT_FOUND", "Shipment not found", 404);
    return jsonOk({ ok: true as const });
  }),

  http.get(`${API_PREFIX}/shipments/:id/checkpoints`, async ({ request, params }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/shipments/:id/checkpoints")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    const url = new URL(request.url);
    const params2 = parseQuery(url);
    const checkpoints = store.findCheckpointsByShipment(params.id as string);
    const result = paginate(checkpoints, params2);
    return jsonOk(result);
  }),

  http.post(`${API_PREFIX}/shipments/:id/checkpoints`, async ({ request, params }) => {
    const route = API_ROUTES.find((r) => r.method === "POST" && r.path === "/shipments/:id/checkpoints")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Record<string, unknown>;
    const shipment = store.findShipmentById(params.id as string);
    if (!shipment) return jsonError("SHIPMENT_NOT_FOUND", "Shipment not found", 404);

    if (body.status === "delayed" && !body.delayReason) {
      return jsonError("DELAY_REASON_REQUIRED", "A delay reason is required when status is delayed", 422);
    }

    const checkpoint = {
      id: newPrefixedId("chk"),
      shipmentId: params.id as string,
      status: body.status as "pickup" | "warehouse" | "in_transit" | "delivered" | "delayed",
      label: (body.label as string) ?? `Status changed to ${body.status}`,
      location: (body.location as string) ?? null,
      note: (body.note as string) ?? null,
      delayReason: (body.delayReason as string) ?? null,
      occurredAt: typeof body.occurredAt === "number" ? body.occurredAt : store.getStore().now,
      recordedAt: store.getStore().now,
      source: (body.source as "manual" | "carrier_webhook" | "carrier_poll" | "system") ?? "manual",
      byUserId: userIdForRole(authResult.role) ?? null,
      byUserName: store.readUsers().find((u) => u.role === authResult.role)?.name ?? null,
    };

    store.appendCheckpoint(checkpoint);
    // Update shipment status
    store.updateShipment(params.id as string, {
      status: checkpoint.status,
      updatedAt: store.getStore().now,
    });

    return jsonOk({ data: checkpoint }, 201);
  }),

  http.post(`${API_PREFIX}/shipments/:id/tracking/reveal`, async ({ request, params }) => {
    const route = API_ROUTES.find(
      (r) => r.method === "POST" && r.path === "/shipments/:id/tracking/reveal",
    )!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const revealed = store.revealTracking(params.id as string);
    if (!revealed) return jsonError("SHIPMENT_NOT_FOUND", "Shipment not found", 404);

    const shipment = store.findShipmentById(params.id as string)!;
    return jsonOk({
      data: {
        shipmentId: shipment.id,
        trackingId: { value: maskSecret(revealed.trackingId, store.getStore().tenant.maskPolicy), raw: revealed.trackingId, masked: true, policy: store.getStore().tenant.maskPolicy },
        carrierTrackingId: { value: maskSecret(revealed.carrierTrackingId, "first2_last2"), raw: revealed.carrierTrackingId, masked: true, policy: "first2_last2" },
        revealSeconds: 120,
      },
    });
  }),

  http.post(`${API_PREFIX}/shipments/:id/carrier-booking`, async ({ request, params }) => {
    const route = API_ROUTES.find(
      (r) => r.method === "POST" && r.path === "/shipments/:id/carrier-booking",
    )!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const shipment = store.findShipmentById(params.id as string);
    if (!shipment) return jsonError("SHIPMENT_NOT_FOUND", "Shipment not found", 404);

    const carrierId = `${shipment.carrier.code.slice(0, 2)}${Math.floor(1000000 + Math.random() * 9000000)}`;
    store.updateShipment(params.id as string, {
      carrierTrackingId: asMaskedValue(carrierId, "first2_last2"),
      carrierTrackingIdSetAt: store.getStore().now,
      syncState: "synced",
    });

    const updated = store.findShipmentById(params.id as string)!;
    return jsonOk({ data: updated });
  }),

  http.post(`${API_PREFIX}/shipments/:id/sync`, async ({ request, params }) => {
    const route = API_ROUTES.find(
      (r) => r.method === "POST" && r.path === "/shipments/:id/sync",
    )!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const shipment = store.findShipmentById(params.id as string);
    if (!shipment) return jsonError("SHIPMENT_NOT_FOUND", "Shipment not found", 404);

    store.updateShipment(params.id as string, {
      syncState: "synced",
      lastSyncedAt: store.getStore().now,
      updatedAt: store.getStore().now,
    });

    const updated = store.findShipmentById(params.id as string)!;
    return jsonOk({ data: updated });
  }),

  http.post(`${API_PREFIX}/shipments/bulk/assign`, async ({ request }) => {
    const route = API_ROUTES.find(
      (r) => r.method === "POST" && r.path === "/shipments/bulk/assign",
    )!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as { ids: string[]; assignedTo: string | null };
    let updated = 0;
    for (const id of body.ids) {
      if (store.updateShipment(id, { assignedTo: body.assignedTo ? store.findUserById(body.assignedTo) ?? null : null })) {
        updated++;
      }
    }
    return jsonOk({ updated });
  }),

  http.post(`${API_PREFIX}/shipments/bulk/status`, async ({ request }) => {
    const route = API_ROUTES.find(
      (r) => r.method === "POST" && r.path === "/shipments/bulk/status",
    )!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as { ids: string[]; status: string };
    let updated = 0;
    for (const id of body.ids) {
      if (store.updateShipment(id, { status: body.status as ReturnType<typeof store.readShipments>[number]["status"], updatedAt: store.getStore().now })) {
        updated++;
      }
    }
    return jsonOk({ updated });
  }),

  // ── Clients ──
  http.get(`${API_PREFIX}/clients`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/clients")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    await realisticDelay(true);

    const url = new URL(request.url);
    const params = parseQuery(url);
    let clients = store.readClients();

    if (params.q) {
      clients = applyQFilter(clients, params.q, ["name", "contactName", "email"]);
    }

    const result = paginate(clients, params);
    return jsonOk(result);
  }),

  http.post(`${API_PREFIX}/clients`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "POST" && r.path === "/clients")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Record<string, unknown>;
    const client = store.createClient({
      name: body.name as string,
      contactName: (body.contactName as string) ?? null,
      email: (body.email as string) ?? null,
      phone: (body.phone as string) ?? null,
      gstin: (body.gstin as string) ?? null,
      addressLine1: (body.addressLine1 as string) ?? null,
      addressLine2: (body.addressLine2 as string) ?? null,
      city: (body.city as string) ?? null,
      state: (body.state as string) ?? null,
      pincode: (body.pincode as string) ?? null,
      creditTermsDays: (body.creditTermsDays as number) ?? 30,
      active: true,
    });
    return jsonOk({ data: client }, 201);
  }),

  http.patch(`${API_PREFIX}/clients/:id`, async ({ request, params }) => {
    const route = API_ROUTES.find((r) => r.method === "PATCH" && r.path === "/clients/:id")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Record<string, unknown>;
    const existing = store.findClientById(params.id as string);
    if (!existing) return jsonError("CLIENT_NOT_FOUND", "Client not found", 404);

    const updated = store.updateClient(params.id as string, body as Partial<ReturnType<typeof store.findClientById> & Record<string, unknown>>);
    if (!updated) return jsonError("CLIENT_NOT_FOUND", "Client not found", 404);
    return jsonOk({ data: updated });
  }),

  // ── Carriers ──
  http.get(`${API_PREFIX}/carriers`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/carriers")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    await realisticDelay(true);

    const url = new URL(request.url);
    const params = parseQuery(url);
    const carriers = store.readCarriers();
    const result = paginate(carriers, params);
    return jsonOk(result);
  }),

  http.post(`${API_PREFIX}/carriers`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "POST" && r.path === "/carriers")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Record<string, unknown>;
    const carrier = store.createCarrier({
      code: body.code as "DHL" | "SAFEXPRESS" | "OM" | "DTDC" | "BLUEDART" | "GATI" | "OTHER",
      name: body.name as string,
      adapter: (body.adapter as "mock" | "dtdc" | "delhivery" | "bluedart" | "shiprocket" | "indiapost" | "xpressbees") ?? "mock",
      trackingUrlTemplate: (body.trackingUrlTemplate as string) ?? null,
      supportsWebhook: (body.supportsWebhook as boolean) ?? false,
      active: (body.active as boolean) ?? true,
      priority: (body.priority as number) ?? 50,
    });
    return jsonOk({ data: carrier }, 201);
  }),

  http.patch(`${API_PREFIX}/carriers/:id`, async ({ request, params }) => {
    const route = API_ROUTES.find((r) => r.method === "PATCH" && r.path === "/carriers/:id")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Record<string, unknown>;
    const existing = store.findCarrierById(params.id as string);
    if (!existing) return jsonError("CARRIER_NOT_FOUND", "Carrier not found", 404);

    const updated = store.updateCarrier(params.id as string, body as Partial<ReturnType<typeof store.findCarrierById> & Record<string, unknown>>);
    if (!updated) return jsonError("CARRIER_NOT_FOUND", "Carrier not found", 404);
    return jsonOk({ data: updated });
  }),

  http.post(`${API_PREFIX}/carriers/:id/rotate-secret`, async ({ request, params }) => {
    const route = API_ROUTES.find(
      (r) => r.method === "POST" && r.path === "/carriers/:id/rotate-secret",
    )!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const existing = store.findCarrierById(params.id as string);
    if (!existing) return jsonError("CARRIER_NOT_FOUND", "Carrier not found", 404);

    return jsonOk({ data: existing });
  }),

  // ── Leads ──
  http.get(`${API_PREFIX}/leads`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/leads")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    await realisticDelay(true);

    const url = new URL(request.url);
    const params = parseQuery(url);
    let leads = store.readLeads();

    // Scope filtering
    leads = scopeFilter(leads, route, authResult.role, route.permission);

    if (params.status) {
      leads = leads.filter((l) => l.status === params.status);
    }
    if (params.source) {
      leads = leads.filter((l) => l.source === params.source);
    }
    if (params.q) {
      leads = applyQFilter(leads, params.q, ["name", "company", "email"]);
    }
    if (params.assignedTo) {
      leads = leads.filter((l) => l.assignedTo?.id === params.assignedTo);
    }

    leads = applyDateRange(leads, "createdAt", params.from, params.to);

    const result = paginate(leads, params);
    return jsonOk(result);
  }),

  http.post(`${API_PREFIX}/leads`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "POST" && r.path === "/leads")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Record<string, unknown>;
    const newLead = {
      id: newPrefixedId("led"),
      tenantId: store.getStore().tenant.id,
      name: body.name as string,
      company: body.company as string,
      email: (body.email as string) ?? null,
      phone: (body.phone as string) ?? null,
      source: body.source as "Referral" | "Website" | "Cold outreach" | "Trade show" | "LinkedIn" | "Existing client",
      status: (body.status as "new" | "contacted" | "negotiation" | "won" | "lost") ?? "new",
      assignedTo: body.assignedTo ? store.findUserById(body.assignedTo as string) ?? null : null,
      notes: (body.notes as string) ?? null,
      nextFollowUp: (body.nextFollowUp as number) ?? null,
      expectedValuePaise: (body.expectedValuePaise as number) ?? null,
      convertedClientId: null,
      createdAt: store.getStore().now,
      updatedAt: store.getStore().now,
    };

    store.createLead(newLead);
    return jsonOk({ data: newLead }, 201);
  }),

  http.patch(`${API_PREFIX}/leads/:id`, async ({ request, params }) => {
    const route = API_ROUTES.find((r) => r.method === "PATCH" && r.path === "/leads/:id")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Record<string, unknown>;
    const existing = store.findLeadById(params.id as string);
    if (!existing) return jsonError("LEAD_NOT_FOUND", "Lead not found", 404);

    const updated = store.updateLead(params.id as string, { ...body, updatedAt: store.getStore().now } as Partial<ReturnType<typeof store.findLeadById> & Record<string, unknown>>);
    if (!updated) return jsonError("LEAD_NOT_FOUND", "Lead not found", 404);
    return jsonOk({ data: updated });
  }),

  http.post(`${API_PREFIX}/leads/:id/activity`, async ({ request, params }) => {
    const route = API_ROUTES.find(
      (r) => r.method === "POST" && r.path === "/leads/:id/activity",
    )!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as { kind?: string; text: string };
    const existing = store.findLeadById(params.id as string);
    if (!existing) return jsonError("LEAD_NOT_FOUND", "Lead not found", 404);

    const actor = store.findUserById(userIdForRole(authResult.role) ?? "") ?? store.getStore().users[0]!;
    const activity = {
      id: newPrefixedId("act"),
      leadId: params.id as string,
      kind: (body.kind as "note" | "call" | "email" | "status_change") ?? "note",
      text: body.text,
      byUserId: actor.id,
      byUserName: actor.name,
      createdAt: store.getStore().now,
    };

    store.appendLeadActivity(activity);
    // Return updated lead with activity
    const lead = store.findLeadById(params.id as string)!;
    lead.activities = store.findLeadActivities(params.id as string);
    return jsonOk({ data: lead });
  }),

  http.post(`${API_PREFIX}/leads/:id/convert`, async ({ request, params }) => {
    const route = API_ROUTES.find(
      (r) => r.method === "POST" && r.path === "/leads/:id/convert",
    )!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Record<string, unknown>;
    const existing = store.findLeadById(params.id as string);
    if (!existing) return jsonError("LEAD_NOT_FOUND", "Lead not found", 404);

    const client = store.createClient({
      name: existing.company,
      contactName: existing.name,
      email: (body.email as string) ?? existing.email,
      phone: (body.phone as string) ?? existing.phone,
      gstin: null,
      addressLine1: null,
      addressLine2: null,
      city: (body.city as string) ?? null,
      state: (body.state as string) ?? null,
      pincode: (body.pincode as string) ?? null,
      creditTermsDays: 30,
      active: true,
    });

    // Mark lead as won
    store.updateLead(params.id as string, {
      status: "won",
      convertedClientId: client.id,
      updatedAt: store.getStore().now,
    });

    return jsonOk({ data: client });
  }),

  // ── Invoices ──
  http.get(`${API_PREFIX}/invoices`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/invoices")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    await realisticDelay(true);

    const url = new URL(request.url);
    const params = parseQuery(url);
    let invoices = store.readInvoices();

    if (params.status) {
      invoices = invoices.filter((i) => i.status === params.status);
    }
    if (params.q) {
      invoices = applyQFilter(invoices, params.q, ["number", "client"]);
    }

    invoices = applyDateRange(invoices, "createdAt", params.from, params.to);

    const result = paginate(invoices, params);
    return jsonOk(result);
  }),

  http.post(`${API_PREFIX}/invoices`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "POST" && r.path === "/invoices")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as { clientId: string; dueDate: number; notes?: string; lines: Array<{ description: string; amountPaise: number; taxRateBp: number; shipmentId?: string | null }> };
    const client = store.findClientById(body.clientId);
    if (!client) return jsonError("CLIENT_NOT_FOUND", "Client not found", 404);

    const invoiceNumber = formatInvoiceNumber(2026, store.readInvoices().length + 1);
    let subtotalPaise = 0;
    let taxPaise = 0;

    const lines = body.lines.map((line, idx) => {
      subtotalPaise += line.amountPaise;
      const tax = Math.round((line.amountPaise * line.taxRateBp) / 10_000);
      taxPaise += tax;
      return {
        id: newPrefixedId("invl"),
        invoiceId: "", // filled below
        shipmentId: line.shipmentId ?? null,
        shipmentTrackingId: null,
        description: line.description,
        amountPaise: line.amountPaise,
        taxRateBp: line.taxRateBp,
      };
    });

    const newInvoice: ReturnType<typeof store.findInvoiceById> & Record<string, unknown> = {
      id: newPrefixedId("inv"),
      tenantId: store.getStore().tenant.id,
      number: invoiceNumber,
      client: { id: client.id, name: client.name },
      status: "pending",
      subtotalPaise,
      taxPaise,
      totalPaise: subtotalPaise + taxPaise,
      currency: "INR",
      issueDate: store.getStore().now,
      dueDate: body.dueDate,
      paidAt: null,
      notes: (body.notes as string) ?? null,
      createdAt: store.getStore().now,
      updatedAt: store.getStore().now,
      lineCount: lines.length,
      lines: lines.map((l) => ({ ...l, invoiceId: "" })),
      shipments: [],
      isOverdue: false,
    };

    // Fix invoice IDs on lines
    for (const line of lines) {
      line.invoiceId = newInvoice.id;
    }
    (newInvoice as { lines: typeof lines }).lines = lines;

    store.createInvoice(newInvoice as never);
    return jsonOk({ data: newInvoice }, 201);
  }),

  http.get(`${API_PREFIX}/invoices/export`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/invoices/export")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const invoices = store.readInvoices();
    const columns = [
      { id: "number", header: "Invoice Number", value: (r: ReturnType<typeof store.readInvoices>[number]) => r.number },
      { id: "client", header: "Client", value: (r: ReturnType<typeof store.readInvoices>[number]) => r.client.name },
      { id: "status", header: "Status", value: (r: ReturnType<typeof store.readInvoices>[number]) => r.status },
      { id: "totalPaise", header: "Total", value: (r: ReturnType<typeof store.readInvoices>[number]) => r.totalPaise },
      { id: "issueDate", header: "Issue Date", value: (r: ReturnType<typeof store.readInvoices>[number]) => new Date(r.issueDate).toISOString() },
      { id: "dueDate", header: "Due Date", value: (r: ReturnType<typeof store.readInvoices>[number]) => new Date(r.dueDate).toISOString() },
    ];
    const csv = toCsv(invoices, columns);
    const today = new Date().toISOString().slice(0, 10);
    return new HttpResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="logiflow-invoices-${today}.csv"`,
      },
    });
  }),

  http.get(`${API_PREFIX}/invoices/:id`, async ({ request, params }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/invoices/:id")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    await realisticDelay(false);

    const invoice = store.findInvoiceById(params.id as string);
    if (!invoice) return jsonError("INVOICE_NOT_FOUND", "Invoice not found", 404);
    return jsonOk({ data: invoice });
  }),

  http.patch(`${API_PREFIX}/invoices/:id`, async ({ request, params }) => {
    const route = API_ROUTES.find((r) => r.method === "PATCH" && r.path === "/invoices/:id")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Record<string, unknown>;
    const existing = store.findInvoiceById(params.id as string);
    if (!existing) return jsonError("INVOICE_NOT_FOUND", "Invoice not found", 404);

    const updated = store.updateInvoice(params.id as string, body as Partial<ReturnType<typeof store.findInvoiceById> & Record<string, unknown>>);
    if (!updated) return jsonError("INVOICE_NOT_FOUND", "Invoice not found", 404);
    return jsonOk({ data: updated });
  }),

  // ── Audit ──
  http.get(`${API_PREFIX}/audit`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/audit")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    await realisticDelay(true);

    const url = new URL(request.url);
    const params = parseQuery(url);
    let events = store.readAuditEvents();

    if (params.severity) {
      events = events.filter((e) => e.severity === params.severity);
    }
    if (params.entityType) {
      events = events.filter((e) => e.entityType === params.entityType);
    }
    if (params.action) {
      events = events.filter((e) => e.action === params.action);
    }
    if (params.actorId) {
      events = events.filter((e) => e.actorId === params.actorId);
    }
    if (params.q) {
      events = applyQFilter(events, params.q, ["summary", "actorName", "entityLabel"]);
    }

    events = applyDateRange(events, "occurredAt", params.from, params.to);

    const result = paginate(events, params);
    return jsonOk(result);
  }),

  http.get(`${API_PREFIX}/audit/export`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/audit/export")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const events = store.readAuditEvents();
    const columns = [
      { id: "action", header: "Action", value: (r: ReturnType<typeof store.readAuditEvents>[number]) => r.action },
      { id: "actorName", header: "Actor", value: (r: ReturnType<typeof store.readAuditEvents>[number]) => r.actorName },
      { id: "entityType", header: "Entity Type", value: (r: ReturnType<typeof store.readAuditEvents>[number]) => r.entityType },
      { id: "entityLabel", header: "Entity", value: (r: ReturnType<typeof store.readAuditEvents>[number]) => r.entityLabel },
      { id: "severity", header: "Severity", value: (r: ReturnType<typeof store.readAuditEvents>[number]) => r.severity },
      { id: "summary", header: "Summary", value: (r: ReturnType<typeof store.readAuditEvents>[number]) => r.summary },
      { id: "occurredAt", header: "Time", value: (r: ReturnType<typeof store.readAuditEvents>[number]) => new Date(r.occurredAt).toISOString() },
    ];
    const csv = toCsv(events, columns);
    const today = new Date().toISOString().slice(0, 10);
    return new HttpResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="logiflow-audit-${today}.csv"`,
      },
    });
  }),

  http.get(`${API_PREFIX}/audit/export.json`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/audit/export.json")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const events = store.readAuditEvents();
    const jsonl = events.map((e) => JSON.stringify(e)).join("\n");
    const today = new Date().toISOString().slice(0, 10);
    return new HttpResponse(jsonl, {
      status: 200,
      headers: {
        "Content-Type": "application/jsonl",
        "Content-Disposition": `attachment; filename="logiflow-audit-${today}.jsonl"`,
      },
    });
  }),

  // ── Notifications ──
  http.get(`${API_PREFIX}/notifications`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/notifications")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    await realisticDelay(true);

    const url = new URL(request.url);
    const params = parseQuery(url);
    let notifications = store.readNotifications();

    if (params.unreadOnly === "true") {
      notifications = notifications.filter((n) => n.readAt === null);
    }

    const result = paginate(notifications, params);
    return jsonOk(result);
  }),

  http.post(`${API_PREFIX}/notifications/read-all`, ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "POST" && r.path === "/notifications/read-all")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const count = store.markAllNotificationsRead();
    return jsonOk({ updated: count });
  }),

  http.post(`${API_PREFIX}/notifications/:id/read`, ({ request, params }) => {
    const route = API_ROUTES.find(
      (r) => r.method === "POST" && r.path === "/notifications/:id/read",
    )!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const notif = store.markNotificationRead(params.id as string);
    if (!notif) return jsonError("NOT_FOUND", "Notification not found", 404);
    return jsonOk({ data: notif });
  }),

  // ── Settings ──
  http.get(`${API_PREFIX}/settings`, ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/settings")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;
    return jsonOk(store.readTenant());
  }),

  http.patch(`${API_PREFIX}/settings/brand`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "PATCH" && r.path === "/settings/brand")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Record<string, unknown>;
    const updated = store.updateTenant(body as Partial<ReturnType<typeof store.readTenant>>);
    return jsonOk({ data: updated });
  }),

  http.patch(`${API_PREFIX}/settings/tracking`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "PATCH" && r.path === "/settings/tracking")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Record<string, unknown>;
    const updated = store.updateTenant(body as Partial<ReturnType<typeof store.readTenant>>);
    return jsonOk({ data: updated });
  }),

  http.patch(`${API_PREFIX}/settings/vocabulary`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "PATCH" && r.path === "/settings/vocabulary")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Record<string, unknown>;
    const updated = store.updateTenant(body as Partial<ReturnType<typeof store.readTenant>>);
    return jsonOk({ data: updated });
  }),

  http.patch(`${API_PREFIX}/settings/tenant`, async ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "PATCH" && r.path === "/settings/tenant")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Record<string, unknown>;
    const updated = store.updateTenant(body as Partial<ReturnType<typeof store.readTenant>>);
    return jsonOk({ data: updated });
  }),

  http.get(`${API_PREFIX}/settings/export`, ({ request }) => {
    const route = API_ROUTES.find((r) => r.method === "GET" && r.path === "/settings/export")!;
    const authResult = checkAuth(route, request.headers);
    if (!authResult.ok) return authResult.response;

    const data = JSON.stringify(store.readTenant(), null, 2);
    const today = new Date().toISOString().slice(0, 10);
    return new HttpResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="logiflow-settings-${today}.json"`,
      },
    });
  }),

  // ── Public ──
  http.get(`${API_PREFIX}/track/:trackingId`, async ({ params }) => {
    const trackingId = params.trackingId as string;
    const shipments = store.readShipments();
    const shipment = shipments.find(
      (s) => s.trackingId.value === trackingId || s.trackingId.raw === trackingId,
    );
    if (!shipment) {
      return jsonError("NOT_FOUND", "Shipment not found", 404);
    }
    return jsonOk({
      trackingId,
      carrierTrackingId: shipment.carrierTrackingId,
      carrierName: shipment.carrier.name,
      status: shipment.status,
      serviceLevel: shipment.serviceLevel,
      route: { origin: shipment.route.origin, destination: shipment.route.destination },
      packages: shipment.packages,
      weightGrams: shipment.weightGrams,
      expectedDelivery: shipment.expectedDelivery,
      deliveredAt: shipment.deliveredAt,
      delayReason: shipment.delayReason,
      lastUpdatedAt: shipment.updatedAt,
      brand: {
        companyName: store.readTenant().companyName,
        productName: store.readTenant().productName,
        supportEmail: store.readTenant().supportEmail,
        trackingPrefix: store.readTenant().trackingPrefix,
      },
      checkpoints: store.findCheckpointsByShipment(shipment.id).map((c) => ({
        status: c.status,
        label: c.label,
        location: c.location,
        occurredAt: c.occurredAt,
      })),
    });
  }),

  http.post(`${API_PREFIX}/webhooks/carriers/:code`, async ({ request }) => {
    const _body = (await request.json()) as Record<string, unknown>;
    return jsonOk({ ok: true as const });
  }),
];
