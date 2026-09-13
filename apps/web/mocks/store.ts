/**
 * In-memory store for mock mode (PRD §17.2).
 *
 * A module-level singleton seeded from demoDataset(). Deep-copies on read so
 * callers never hold mutable references. Supports create/update/delete for
 * every entity the UI touches.
 */
import {
  demoDataset,
  demoKpis,
  type DemoDataset,
  type AuditEventDTO,
  type Carrier,
  type CheckpointDTO,
  type ClientDTO,
  type InvoiceDTO,
  type LeadDTO,
  type LeadActivityDTO,
  type NotificationDTO,
  type ShipmentDTO,
  type Tenant,
  type UserDTO,
  type KpiCard,
} from "@logiflow/contracts";
import { newId, newPrefixedId } from "@logiflow/shared";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** Internal version that tracks version for idempotency. */
export interface Store {
  tenant: Tenant;
  users: UserDTO[];
  carriers: Carrier[];
  clients: ClientDTO[];
  shipments: ShipmentDTO[];
  checkpoints: CheckpointDTO[];
  leads: LeadDTO[];
  leadActivities: LeadActivityDTO[];
  invoices: InvoiceDTO[];
  notifications: NotificationDTO[];
  auditEvents: AuditEventDTO[];
  kpis: KpiCard[];
  now: number;
  /** Idempotency replay cache: key → response body. */
  idempotencyCache: Map<string, unknown>;
}

let _store: Store | null = null;

function buildStore(now?: number): Store {
  const dataset: DemoDataset = demoDataset(now);
  return {
    tenant: dataset.tenant,
    users: dataset.users,
    carriers: dataset.carriers,
    clients: dataset.clients,
    shipments: dataset.shipments,
    checkpoints: dataset.checkpoints,
    leads: dataset.leads,
    leadActivities: dataset.leadActivities,
    invoices: dataset.invoices,
    notifications: dataset.notifications,
    auditEvents: dataset.auditEvents,
    kpis: demoKpis(dataset),
    now: dataset.now,
    idempotencyCache: new Map(),
  };
}

export function resetStore(now?: number): void {
  _store = buildStore(now);
}

export function getStore(): Store {
  if (!_store) _store = buildStore();
  return _store;
}

// ── Deep-read accessors ──────────────────────────────────────────────────

export function readUsers(): UserDTO[] {
  return deepClone(getStore().users);
}

export function findUserByEmail(email: string): UserDTO | undefined {
  const store = getStore();
  return store.users.find((u) => u.email === email) ?? undefined;
}

export function findUserById(id: string): UserDTO | undefined {
  const store = getStore().users.find((u) => u.id === id);
  return store ? deepClone(store) : undefined;
}

export function readClients(): ClientDTO[] {
  return deepClone(getStore().clients);
}

export function findClientById(id: string): ClientDTO | undefined {
  const store = getStore();
  const client = store.clients.find((c) => c.id === id);
  return client ? deepClone(client) : undefined;
}

export function readCarriers(): Carrier[] {
  return deepClone(getStore().carriers);
}

export function findCarrierById(id: string): Carrier | undefined {
  const store = getStore();
  const carrier = store.carriers.find((c) => c.id === id);
  return carrier ? deepClone(carrier) : undefined;
}

export function readShipments(): ShipmentDTO[] {
  return deepClone(getStore().shipments);
}

export function findShipmentById(id: string): ShipmentDTO | undefined {
  const store = getStore();
  const shipment = store.shipments.find((s) => s.id === id);
  return shipment ? deepClone(shipment) : undefined;
}

export function readCheckpoints(): CheckpointDTO[] {
  return deepClone(getStore().checkpoints);
}

export function readLeads(): LeadDTO[] {
  return deepClone(getStore().leads);
}

export function findLeadById(id: string): LeadDTO | undefined {
  const store = getStore();
  const lead = store.leads.find((l) => l.id === id);
  return lead ? deepClone(lead) : undefined;
}

export function readInvoices(): InvoiceDTO[] {
  return deepClone(getStore().invoices);
}

export function findInvoiceById(id: string): InvoiceDTO | undefined {
  const store = getStore();
  const inv = store.invoices.find((i) => i.id === id);
  return inv ? deepClone(inv) : undefined;
}

export function readNotifications(): NotificationDTO[] {
  return deepClone(getStore().notifications);
}

export function readAuditEvents(): AuditEventDTO[] {
  return deepClone(getStore().auditEvents);
}

export function readKpis(): KpiCard[] {
  return deepClone(getStore().kpis);
}

export function readTenant(): Tenant {
  return deepClone(getStore().tenant);
}

// ── Mutations ────────────────────────────────────────────────────────────

function appendAudit(event: Omit<AuditEventDTO, "id" | "requestId">): AuditEventDTO {
  const store = getStore();
  const full: AuditEventDTO = {
    ...event,
    id: newPrefixedId("aud"),
    requestId: newPrefixedId("req"),
  };
  store.auditEvents.unshift(full);
  return deepClone(full);
}

function prependAudit(event: Omit<AuditEventDTO, "id" | "requestId">): AuditEventDTO {
  return appendAudit(event);
}

export function createClient(
  data: Omit<ClientDTO, "id" | "tenantId" | "createdAt" | "shipmentCount" | "outstandingPaise">,
): ClientDTO {
  const store = getStore();
  const client: ClientDTO = {
    ...data,
    id: newPrefixedId("cli"),
    tenantId: store.tenant.id,
    createdAt: store.now,
    shipmentCount: 0,
    outstandingPaise: 0,
  };
  store.clients.push(client);
  prependAudit({
    tenantId: store.tenant.id,
    occurredAt: store.now,
    actorType: "user",
    actorId: store.users[0]?.id ?? null,
    actorName: store.users[0]?.name ?? "System",
    actorAvatarUrl: null,
    action: "client.created",
    entityType: "client",
    entityId: client.id,
    entityLabel: client.name,
    severity: "info",
    summary: `Added client ${client.name}`,
    changes: null,
    ip: "127.0.0.1",
    userAgent: "mock",
    source: "web",
  });
  return deepClone(client);
}

export function updateClient(
  id: string,
  data: Partial<ClientDTO>,
): ClientDTO | undefined {
  const store = getStore();
  const idx = store.clients.findIndex((c) => c.id === id);
  if (idx === -1) return undefined;
  store.clients[idx] = { ...store.clients[idx]!, ...data };
  return deepClone(store.clients[idx]!);
}

export function createCarrier(
  data: Omit<Carrier, "id" | "tenantId" | "createdAt" | "openShipments">,
): Carrier {
  const store = getStore();
  const carrier: Carrier = {
    ...data,
    id: newPrefixedId("car"),
    tenantId: store.tenant.id,
    createdAt: store.now,
    openShipments: 0,
  };
  store.carriers.push(carrier);
  prependAudit({
    tenantId: store.tenant.id,
    occurredAt: store.now,
    actorType: "user",
    actorId: store.users[0]?.id ?? null,
    actorName: store.users[0]?.name ?? "System",
    actorAvatarUrl: null,
    action: "carrier.created",
    entityType: "carrier",
    entityId: carrier.id,
    entityLabel: carrier.name,
    severity: "info",
    summary: `Added carrier ${carrier.name}`,
    changes: null,
    ip: "127.0.0.1",
    userAgent: "mock",
    source: "web",
  });
  return deepClone(carrier);
}

export function updateCarrier(
  id: string,
  data: Partial<Carrier>,
): Carrier | undefined {
  const store = getStore();
  const idx = store.carriers.findIndex((c) => c.id === id);
  if (idx === -1) return undefined;
  store.carriers[idx] = { ...store.carriers[idx]!, ...data };
  return deepClone(store.carriers[idx]!);
}

export function createShipment(
  shipment: ShipmentDTO,
): ShipmentDTO {
  const store = getStore();
  store.shipments.unshift(shipment);
  prependAudit({
    tenantId: store.tenant.id,
    occurredAt: store.now,
    actorType: "user",
    actorId: store.users[0]?.id ?? null,
    actorName: store.users[0]?.name ?? "System",
    actorAvatarUrl: null,
    action: "shipment.created",
    entityType: "shipment",
    entityId: shipment.id,
    entityLabel: shipment.trackingId.value,
    severity: "info",
    summary: `Created consignment ${shipment.trackingId.value}`,
    changes: null,
    ip: "127.0.0.1",
    userAgent: "mock",
    source: "web",
  });
  return deepClone(shipment);
}

export function updateShipment(
  id: string,
  data: Partial<ShipmentDTO>,
): ShipmentDTO | undefined {
  const store = getStore();
  const idx = store.shipments.findIndex((s) => s.id === id);
  if (idx === -1) return undefined;
  store.shipments[idx] = { ...store.shipments[idx]!, ...data };
  return deepClone(store.shipments[idx]!);
}

export function deleteShipment(id: string): boolean {
  const store = getStore();
  const idx = store.shipments.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  const removed = store.shipments.splice(idx, 1)[0]!;
  prependAudit({
    tenantId: store.tenant.id,
    occurredAt: store.now,
    actorType: "user",
    actorId: store.users[0]?.id ?? null,
    actorName: store.users[0]?.name ?? "System",
    actorAvatarUrl: null,
    action: "shipment.deleted",
    entityType: "shipment",
    entityId: removed.id,
    entityLabel: removed.trackingId.value,
    severity: "warn",
    summary: `Deleted consignment ${removed.trackingId.value}`,
    changes: null,
    ip: "127.0.0.1",
    userAgent: "mock",
    source: "web",
  });
  return true;
}

export function appendCheckpoint(checkpoint: CheckpointDTO): CheckpointDTO {
  const store = getStore();
  store.checkpoints.push(checkpoint);
  prependAudit({
    tenantId: store.tenant.id,
    occurredAt: store.now,
    actorType: "user",
    actorId: store.users[0]?.id ?? null,
    actorName: store.users[0]?.name ?? "System",
    actorAvatarUrl: null,
    action: "checkpoint.logged",
    entityType: "checkpoint",
    entityId: checkpoint.id,
    entityLabel: checkpoint.label,
    severity: "info",
    summary: `Logged a checkpoint on ${checkpoint.label}`,
    changes: null,
    ip: "127.0.0.1",
    userAgent: "mock",
    source: "web",
  });
  return deepClone(checkpoint);
}

export function findCheckpointsByShipment(shipmentId: string): CheckpointDTO[] {
  return deepClone(
    getStore().checkpoints.filter((c) => c.shipmentId === shipmentId),
  );
}

export function createLead(
  lead: LeadDTO,
): LeadDTO {
  const store = getStore();
  store.leads.unshift(lead);
  prependAudit({
    tenantId: store.tenant.id,
    occurredAt: store.now,
    actorType: "user",
    actorId: store.users[0]?.id ?? null,
    actorName: store.users[0]?.name ?? "System",
    actorAvatarUrl: null,
    action: "lead.created",
    entityType: "lead",
    entityId: lead.id,
    entityLabel: lead.name,
    severity: "info",
    summary: `Created lead ${lead.name}`,
    changes: null,
    ip: "127.0.0.1",
    userAgent: "mock",
    source: "web",
  });
  return deepClone(lead);
}

export function updateLead(
  id: string,
  data: Partial<LeadDTO>,
): LeadDTO | undefined {
  const store = getStore();
  const idx = store.leads.findIndex((l) => l.id === id);
  if (idx === -1) return undefined;
  store.leads[idx] = { ...store.leads[idx]!, ...data };
  return deepClone(store.leads[idx]!);
}

export function appendLeadActivity(activity: LeadActivityDTO): LeadActivityDTO {
  const store = getStore();
  store.leadActivities.push(activity);
  prependAudit({
    tenantId: store.tenant.id,
    occurredAt: store.now,
    actorType: "user",
    actorId: store.users[0]?.id ?? null,
    actorName: store.users[0]?.name ?? "System",
    actorAvatarUrl: null,
    action: "lead.activity_logged",
    entityType: "lead",
    entityId: activity.leadId,
    entityLabel: activity.text.slice(0, 40),
    severity: "info",
    summary: `Logged lead activity: ${activity.text.slice(0, 40)}`,
    changes: null,
    ip: "127.0.0.1",
    userAgent: "mock",
    source: "web",
  });
  return deepClone(activity);
}

export function findLeadActivities(leadId: string): LeadActivityDTO[] {
  return deepClone(
    getStore().leadActivities.filter((a) => a.leadId === leadId),
  );
}

export function createInvoice(
  invoice: InvoiceDTO,
): InvoiceDTO {
  const store = getStore();
  store.invoices.unshift(invoice);
  prependAudit({
    tenantId: store.tenant.id,
    occurredAt: store.now,
    actorType: "user",
    actorId: store.users[0]?.id ?? null,
    actorName: store.users[0]?.name ?? "System",
    actorAvatarUrl: null,
    action: "invoice.created",
    entityType: "invoice",
    entityId: invoice.id,
    entityLabel: invoice.number,
    severity: "info",
    summary: `Created invoice ${invoice.number}`,
    changes: null,
    ip: "127.0.0.1",
    userAgent: "mock",
    source: "web",
  });
  return deepClone(invoice);
}

export function updateInvoice(
  id: string,
  data: Partial<InvoiceDTO>,
): InvoiceDTO | undefined {
  const store = getStore();
  const idx = store.invoices.findIndex((i) => i.id === id);
  if (idx === -1) return undefined;
  store.invoices[idx] = { ...store.invoices[idx]!, ...data };
  return deepClone(store.invoices[idx]!);
}

export function markNotificationRead(id: string): NotificationDTO | undefined {
  const store = getStore();
  const notif = store.notifications.find((n) => n.id === id);
  if (!notif) return undefined;
  notif.readAt = store.now;
  return deepClone(notif);
}

export function markAllNotificationsRead(): number {
  const store = getStore();
  let count = 0;
  for (const n of store.notifications) {
    if (n.readAt === null) {
      n.readAt = store.now;
      count++;
    }
  }
  return count;
}

export function updateTenant(data: Partial<Tenant>): Tenant {
  const store = getStore();
  store.tenant = { ...store.tenant, ...data };
  return deepClone(store.tenant);
}

export function addTeamMember(user: UserDTO): UserDTO {
  const store = getStore();
  store.users.push(user);
  prependAudit({
    tenantId: store.tenant.id,
    occurredAt: store.now,
    actorType: "user",
    actorId: store.users[0]?.id ?? null,
    actorName: store.users[0]?.name ?? "System",
    actorAvatarUrl: null,
    action: "team.invited",
    entityType: "team",
    entityId: user.id,
    entityLabel: user.name,
    severity: "info",
    summary: `Invited ${user.name} to the workspace`,
    changes: null,
    ip: "127.0.0.1",
    userAgent: "mock",
    source: "web",
  });
  return deepClone(user);
}

export function updateTeamMember(
  id: string,
  data: Partial<UserDTO>,
): UserDTO | undefined {
  const store = getStore();
  const idx = store.users.findIndex((u) => u.id === id);
  if (idx === -1) return undefined;
  store.users[idx] = { ...store.users[idx]!, ...data };
  return deepClone(store.users[idx]!);
}

export function getIdempotencyResult<T>(key: string): T | undefined {
  return getStore().idempotencyCache.get(key) as T | undefined;
}

export function setIdempotencyResult(key: string, value: unknown): void {
  getStore().idempotencyCache.set(key, value);
}

/** Reveal tracking IDs for a shipment (only when caller has tracking:reveal). */
export function revealTracking(
  shipmentId: string,
): { trackingId: string; carrierTrackingId: string } | undefined {
  const store = getStore();
  const s = store.shipments.find((sh) => sh.id === shipmentId);
  if (!s) return undefined;
  return {
    trackingId: s.trackingId.raw ?? s.trackingId.value,
    carrierTrackingId: s.carrierTrackingId.raw ?? s.carrierTrackingId.value,
  };
}
