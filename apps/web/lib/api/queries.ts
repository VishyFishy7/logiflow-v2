"use client";

/**
 * React Query bindings for `lib/api/resources.ts`.
 *
 * Conventions the whole app follows (§4.5):
 *  - every list is paginated server-side; the filter state lives in the URL
 *  - mutations invalidate their own resource prefix, never the whole cache
 *  - `keepPreviousData` so paging never blanks a table
 */
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
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
  ShipmentDTO,
  ShipmentDetailDTO,
  ShipmentListQuery,
  Tenant,
  UserDTO,
} from "@logiflow/contracts";
import { audit, auth, carriers, clients, invoices, leads, notifications, settings, shipments, tracking } from "./resources";

/** Stable, predictable keys — invalidation targets a prefix, not a URL. */
export const keys = {
  session: ["session"] as const,
  team: ["team"] as const,
  shipments: (query?: object) => ["shipments", query ?? {}] as const,
  shipmentsAll: ["shipments"] as const,
  shipment: (id: string) => ["shipment", id] as const,
  checkpoints: (id: string) => ["checkpoints", id] as const,
  shipmentStats: (query?: object) => ["shipment-stats", query ?? {}] as const,
  clients: (query?: object) => ["clients", query ?? {}] as const,
  clientsAll: ["clients"] as const,
  carriers: ["carriers"] as const,
  leads: (query?: object) => ["leads", query ?? {}] as const,
  leadsAll: ["leads"] as const,
  invoices: (query?: object) => ["invoices", query ?? {}] as const,
  invoicesAll: ["invoices"] as const,
  invoice: (id: string) => ["invoice", id] as const,
  audit: (query?: object) => ["audit", query ?? {}] as const,
  notifications: ["notifications"] as const,
  settings: ["settings"] as const,
  tracking: (id: string) => ["tracking", id] as const,
};

type QueryOpts<T> = Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">;

// ── session ─────────────────────────────────────────────────────────────────
export function useSession(options?: QueryOpts<SessionResponse>) {
  return useQuery({
    queryKey: keys.session,
    queryFn: ({ signal }) => auth.session(signal),
    staleTime: 60_000,
    ...options,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string; tenantSlug?: string }) => auth.login(input),
    onSuccess: (data) => qc.setQueryData(keys.session, data),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => auth.logout(),
    onSuccess: () => qc.clear(),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => auth.updateProfile(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.session }),
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: (input: unknown) => auth.changePassword(input) });
}

// ── team ────────────────────────────────────────────────────────────────────
export function useTeam(options?: QueryOpts<ListEnvelope<UserDTO>>) {
  return useQuery({ queryKey: keys.team, queryFn: ({ signal }) => auth.team(signal), ...options });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => auth.invite(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.team }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: unknown }) => auth.updateMember(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.team }),
  });
}

// ── shipments ───────────────────────────────────────────────────────────────
export function useShipments(query?: ShipmentListQuery, options?: QueryOpts<ListEnvelope<ShipmentDTO>>) {
  return useQuery({
    queryKey: keys.shipments(query),
    queryFn: ({ signal }) => shipments.list(query, signal),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useShipment(id: string | undefined, options?: QueryOpts<ShipmentDetailDTO>) {
  return useQuery({
    queryKey: keys.shipment(id ?? "none"),
    queryFn: ({ signal }) => shipments.get(id as string, signal),
    enabled: Boolean(id),
    ...options,
  });
}

export function useCheckpoints(id: string | undefined) {
  return useQuery({
    queryKey: keys.checkpoints(id ?? "none"),
    queryFn: ({ signal }) => shipments.checkpoints(id as string, signal),
    enabled: Boolean(id),
  });
}

export function useShipmentStats<T = DashboardStats | AnalyticsStats>(query?: object) {
  return useQuery({
    queryKey: keys.shipmentStats(query),
    queryFn: ({ signal }) => shipments.stats(query, signal) as Promise<T>,
  });
}

/** Any mutation on a shipment refreshes the list, the row and the stats. */
function useShipmentInvalidate() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: keys.shipmentsAll });
    qc.invalidateQueries({ queryKey: ["shipment-stats"] });
    if (id) {
      qc.invalidateQueries({ queryKey: keys.shipment(id) });
      qc.invalidateQueries({ queryKey: keys.checkpoints(id) });
    }
  };
}

export function useCreateShipment() {
  const invalidate = useShipmentInvalidate();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: unknown; idempotencyKey?: string }) =>
      shipments.create(input, idempotencyKey),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateShipment(id: string) {
  const invalidate = useShipmentInvalidate();
  return useMutation({
    mutationFn: (input: unknown) => shipments.update(id, input),
    onSuccess: () => invalidate(id),
  });
}

export function useDeleteShipment() {
  const invalidate = useShipmentInvalidate();
  return useMutation({
    mutationFn: (id: string) => shipments.remove(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export function useLogCheckpoint(id: string) {
  const invalidate = useShipmentInvalidate();
  const qc = useQueryClient();
  return useMutation<{ data: CheckpointDTO }, Error, unknown>({
    mutationFn: (input) => shipments.logCheckpoint(id, input),
    onSuccess: () => {
      invalidate(id);
      qc.invalidateQueries({ queryKey: keys.audit() });
    },
  });
}

export function useRevealTracking(id: string) {
  const qc = useQueryClient();
  const invalidate = useShipmentInvalidate();
  return useMutation({
    mutationFn: () => shipments.revealTracking(id),
    onSuccess: (data) => {
      qc.setQueryData(keys.shipment(id), data.data);
      invalidate(id);
      // A reveal is itself an audited event (§8.3), so the log must refresh.
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useBookCarrier(id: string) {
  const invalidate = useShipmentInvalidate();
  return useMutation({ mutationFn: () => shipments.bookCarrier(id), onSuccess: () => invalidate(id) });
}

export function useSyncShipment(id: string) {
  const invalidate = useShipmentInvalidate();
  return useMutation({ mutationFn: () => shipments.sync(id), onSuccess: () => invalidate(id) });
}

export function useBulkAssign() {
  const invalidate = useShipmentInvalidate();
  return useMutation({
    mutationFn: (input: unknown) => shipments.bulkAssign(input),
    onSuccess: () => invalidate(),
  });
}

export function useBulkStatus() {
  const invalidate = useShipmentInvalidate();
  return useMutation({
    mutationFn: (input: unknown) => shipments.bulkStatus(input),
    onSuccess: () => invalidate(),
  });
}

// ── clients & carriers ──────────────────────────────────────────────────────
export function useClients(
  query?: { q?: string; page?: number; pageSize?: number },
  options?: QueryOpts<ListEnvelope<ClientDTO>>,
) {
  return useQuery({
    queryKey: keys.clients(query),
    queryFn: ({ signal }) => clients.list(query, signal),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => clients.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.clientsAll }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: unknown }) => clients.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.clientsAll }),
  });
}

export function useCarriers(options?: QueryOpts<ListEnvelope<Carrier>>) {
  return useQuery({ queryKey: keys.carriers, queryFn: ({ signal }) => carriers.list(undefined, signal), ...options });
}

export function useSaveCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: unknown }) =>
      id ? carriers.update(id, input) : carriers.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.carriers }),
  });
}

export function useRotateCarrierSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => carriers.rotateSecret(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.carriers }),
  });
}

// ── leads ───────────────────────────────────────────────────────────────────
export function useLeads(query?: LeadListQuery, options?: QueryOpts<ListEnvelope<LeadDTO>>) {
  return useQuery({
    queryKey: keys.leads(query),
    queryFn: ({ signal }) => leads.list(query, signal),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useSaveLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: unknown }) =>
      id ? leads.update(id, input) : leads.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.leadsAll }),
  });
}

export function useLeadActivity(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => leads.addActivity(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.leadsAll }),
  });
}

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: unknown }) => leads.convert(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.leadsAll });
      qc.invalidateQueries({ queryKey: keys.clientsAll });
    },
  });
}

// ── invoices ────────────────────────────────────────────────────────────────
export function useInvoices(query?: InvoiceListQuery, options?: QueryOpts<ListEnvelope<InvoiceDTO>>) {
  return useQuery({
    queryKey: keys.invoices(query),
    queryFn: ({ signal }) => invoices.list(query, signal),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: keys.invoice(id ?? "none"),
    queryFn: ({ signal }) => invoices.get(id as string, signal),
    enabled: Boolean(id),
  });
}

export function useSaveInvoice(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => (id ? invoices.update(id, input) : invoices.create(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invoicesAll }),
  });
}

// ── audit ───────────────────────────────────────────────────────────────────
export function useAuditLog(query?: AuditListQuery, options?: QueryOpts<ListEnvelope<AuditEventDTO>>) {
  return useQuery({
    queryKey: keys.audit(query),
    queryFn: ({ signal }) => audit.list(query, signal),
    placeholderData: keepPreviousData,
    ...options,
  });
}

// ── notifications ───────────────────────────────────────────────────────────
export function useNotifications(options?: QueryOpts<ListEnvelope<NotificationDTO>>) {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: ({ signal }) => notifications.list(undefined, signal),
    refetchInterval: 60_000,
    ...options,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id?: string): Promise<{ updated: number }> => {
      if (!id) return notifications.readAll();
      await notifications.read(id);
      return { updated: 1 };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}

// ── settings ────────────────────────────────────────────────────────────────
export function useSettings(options?: QueryOpts<Tenant>) {
  return useQuery({ queryKey: keys.settings, queryFn: ({ signal }) => settings.get(signal), ...options });
}

export function useUpdateSettings(section: "brand" | "tracking" | "vocabulary" | "tenant") {
  const qc = useQueryClient();
  const call = {
    brand: settings.updateBrand,
    tracking: settings.updateTracking,
    vocabulary: settings.updateVocabulary,
    tenant: settings.updateTenant,
  }[section];
  return useMutation({
    mutationFn: (input: unknown) => call(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.settings });
      qc.invalidateQueries({ queryKey: keys.session });
    },
  });
}

// ── public tracking ─────────────────────────────────────────────────────────
export function useTrackingLookup(
  trackingId: string | undefined,
  options?: Omit<UseQueryOptions<PublicTrackingResponse, Error>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: keys.tracking(trackingId ?? "none"),
    queryFn: ({ signal }) => tracking.lookup(trackingId as string, signal),
    enabled: Boolean(trackingId && trackingId.length >= 4),
    retry: false,
    ...options,
  });
}

export type { UseMutationOptions };
