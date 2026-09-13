/**
 * Typed data access, one function per contract route the UI actually calls.
 * Components never build URLs themselves — they call these (PRD §4.5).
 */
import type {
  AuditEventDTO,
  AuditListQuery,
  Carrier,
  CheckpointDTO,
  ClientDTO,
  DashboardStats,
  AnalyticsStats,
  InvoiceDTO,
  InvoiceListQuery,
  LeadDTO,
  LeadListQuery,
  ListEnvelope,
  NotificationDTO,
  PublicTrackingResponse,
  SessionResponse,
  ShipmentDetailDTO,
  ShipmentDTO,
  ShipmentListQuery,
  Tenant,
  UserDTO,
} from "@logiflow/contracts";
import { download, http, item, list, plain, type QueryValue } from "./client";

type Params = Record<string, QueryValue>;

/** Query objects from the contracts are already flat scalars — pass them through. */
const asParams = (query?: object): Params | undefined => query as Params | undefined;

// ── auth / session ──────────────────────────────────────────────────────────
export const auth = {
  session: (signal?: AbortSignal) => plain<SessionResponse>("/auth/session", undefined, signal),
  login: (input: { email: string; password: string; tenantSlug?: string }) =>
    http.post<SessionResponse>("/auth/login", input),
  signup: (input: unknown) => http.post<SessionResponse>("/auth/signup", input),
  acceptInvite: (input: unknown) => http.post<SessionResponse>("/auth/accept-invite", input),
  logout: () => http.post<{ ok: true }>("/auth/logout"),
  updateProfile: (input: unknown) => http.patch<{ data: UserDTO }>("/auth/profile", input),
  changePassword: (input: unknown) =>
    http.post<{ ok: true }>("/auth/password", input),
  team: (signal?: AbortSignal) => list<UserDTO>("/auth/team", undefined, signal),
  invite: (input: unknown) => http.post<{ data: UserDTO }>("/auth/team/invite", input),
  updateMember: (id: string, input: unknown) =>
    http.patch<{ data: UserDTO }>(`/auth/team/${id}`, input),
};

// ── shipments (the operational core, §8) ────────────────────────────────────
export const shipments = {
  list: (query?: ShipmentListQuery, signal?: AbortSignal) =>
    list<ShipmentDTO>("/shipments", asParams(query), signal),
  get: (id: string, signal?: AbortSignal) =>
    item<ShipmentDetailDTO>(`/shipments/${id}`, undefined, signal),
  create: (input: unknown, idempotencyKey?: string) =>
    http.post<{ data: ShipmentDTO }>("/shipments", input, { idempotencyKey }),
  update: (id: string, input: unknown) => http.patch<{ data: ShipmentDTO }>(`/shipments/${id}`, input),
  remove: (id: string) => http.delete<{ ok: true }>(`/shipments/${id}`),
  checkpoints: (id: string, signal?: AbortSignal) =>
    list<CheckpointDTO>(`/shipments/${id}/checkpoints`, undefined, signal),
  logCheckpoint: (id: string, input: unknown) =>
    http.post<{ data: CheckpointDTO }>(`/shipments/${id}/checkpoints`, input),
  stats: (query?: object, signal?: AbortSignal) =>
    plain<DashboardStats | AnalyticsStats>("/shipments/stats", asParams(query), signal),
  bookCarrier: (id: string) => http.post<{ data: ShipmentDTO }>(`/shipments/${id}/carrier-booking`),
  sync: (id: string) => http.post<{ data: ShipmentDTO }>(`/shipments/${id}/sync`),
  /**
   * Masked IDs are the default everywhere (§8.3); this asks the server for the
   * raw values and is the only call that can ever return them.
   */
  revealTracking: (id: string) => http.post<{ data: ShipmentDTO }>(`/shipments/${id}/tracking/reveal`),
  bulkAssign: (input: unknown) => http.post<{ updated: number }>("/shipments/bulk/assign", input),
  bulkStatus: (input: unknown) => http.post<{ updated: number }>("/shipments/bulk/status", input),
  exportCsv: (query?: ShipmentListQuery) => download("/shipments/export", asParams(query)),
};

// ── clients & carriers ──────────────────────────────────────────────────────
export const clients = {
  list: (query?: { q?: string; page?: number; pageSize?: number }, signal?: AbortSignal) =>
    list<ClientDTO>("/clients", asParams(query), signal),
  create: (input: unknown) => http.post<{ data: ClientDTO }>("/clients", input),
  update: (id: string, input: unknown) => http.patch<{ data: ClientDTO }>(`/clients/${id}`, input),
};

export const carriers = {
  list: (query?: object, signal?: AbortSignal) => list<Carrier>("/carriers", asParams(query), signal),
  create: (input: unknown) => http.post<{ data: Carrier }>("/carriers", input),
  update: (id: string, input: unknown) => http.patch<{ data: Carrier }>(`/carriers/${id}`, input),
  rotateSecret: (id: string) => http.post<{ data: Carrier }>(`/carriers/${id}/rotate-secret`),
};

// ── leads ───────────────────────────────────────────────────────────────────
export const leads = {
  list: (query?: LeadListQuery, signal?: AbortSignal) =>
    list<LeadDTO>("/leads", asParams(query), signal),
  create: (input: unknown) => http.post<{ data: LeadDTO }>("/leads", input),
  update: (id: string, input: unknown) => http.patch<{ data: LeadDTO }>(`/leads/${id}`, input),
  addActivity: (id: string, input: unknown) =>
    http.post<{ data: LeadDTO }>(`/leads/${id}/activity`, input),
  convert: (id: string, input: unknown) =>
    http.post<{ data: ClientDTO }>(`/leads/${id}/convert`, input),
};

// ── invoices ────────────────────────────────────────────────────────────────
export const invoices = {
  list: (query?: InvoiceListQuery, signal?: AbortSignal) =>
    list<InvoiceDTO>("/invoices", asParams(query), signal),
  get: (id: string, signal?: AbortSignal) => item<InvoiceDTO>(`/invoices/${id}`, undefined, signal),
  create: (input: unknown) => http.post<{ data: InvoiceDTO }>("/invoices", input),
  update: (id: string, input: unknown) =>
    http.patch<{ data: InvoiceDTO }>(`/invoices/${id}`, input),
  exportCsv: (query?: object) => download("/invoices/export", asParams(query)),
};

// ── audit (§9.2, §14.7) ─────────────────────────────────────────────────────
export const audit = {
  list: (query?: AuditListQuery, signal?: AbortSignal) =>
    list<AuditEventDTO>("/audit", asParams(query), signal),
  exportCsv: (query?: AuditListQuery) => download("/audit/export", asParams(query)),
  exportJsonl: (query?: AuditListQuery) => download("/audit/export.json", asParams(query)),
};

// ── notifications ───────────────────────────────────────────────────────────
export const notifications = {
  list: (query?: { unreadOnly?: boolean }, signal?: AbortSignal) =>
    list<NotificationDTO>("/notifications", asParams(query), signal),
  readAll: () => http.post<{ updated: number }>("/notifications/read-all"),
  read: (id: string) => http.post<{ data: NotificationDTO }>(`/notifications/${id}/read`),
};

// ── settings (§14.9) ────────────────────────────────────────────────────────
export const settings = {
  get: (signal?: AbortSignal) => plain<Tenant>("/settings", undefined, signal),
  updateBrand: (input: unknown) => http.patch<{ data: Tenant }>("/settings/brand", input),
  updateTracking: (input: unknown) => http.patch<{ data: Tenant }>("/settings/tracking", input),
  updateVocabulary: (input: unknown) => http.patch<{ data: Tenant }>("/settings/vocabulary", input),
  updateTenant: (input: unknown) => http.patch<{ data: Tenant }>("/settings/tenant", input),
  exportSnapshot: () => download("/settings/export"),
};

// ── public tracking (§14.11) ────────────────────────────────────────────────
export const tracking = {
  lookup: (trackingId: string, signal?: AbortSignal) =>
    plain<PublicTrackingResponse>(
      `/track/${encodeURIComponent(trackingId)}`,
      undefined,
      signal,
    ),
};

export type { ListEnvelope };
