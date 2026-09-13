/**
 * The demo dataset (PRD §9.3, §17.2).
 *
 * One deterministic generator feeds BOTH deployment modes:
 *   - mock mode: the MSW handlers serve these exact objects, so every screen
 *     has realistic data with no server, no DB and no credentials;
 *   - live mode: `packages/db/src/seed.ts` inserts the same objects into
 *     SQLite, so the two modes are visually identical.
 *
 * Determinism matters: the PRNG and the date offsets are fixed relative to the
 * `now` argument, so screenshots, fixtures and tests all agree.
 */
import { z } from "zod";

import {
  asMaskedValue,
  computeInvoiceTotals,
  formatInvoiceNumber,
  normalisePrefix,
  grantFor,
  permissionsFor,
} from "@logiflow/shared";
import { TRACKING_ALPHABET, TRACKING_BODY_LENGTH } from "@logiflow/shared";
import type { Grant, Permission, Role } from "@logiflow/shared";
import type {
  AuditEventDTO,
  Carrier,
  CheckpointDTO,
  ClientDTO,
  InvoiceDTO,
  InvoiceLineDTO,
  KpiCard,
  LeadActivityDTO,
  LeadDTO,
  NotificationDTO,
  SessionResponse,
  ShipmentDTO,
  Tenant,
  UserDTO,
  UserRef,
} from "./entities";
import { zJob } from "./entities";
import type { JobType, NotificationType, ShipmentStatus } from "./enums";
import {
  CARRIER_ADAPTERS,
  LEAD_SOURCES,
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  SYNC_STATE_LABELS,
} from "./enums";

export type JobDTO = z.infer<typeof zJob>;
/** Mock-mode sign-in accepts exactly this; the real app never contains it. */
export const DEMO_PASSWORD = "LogiFlow@2026";

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** mulberry32 — small, fast, and identical on every machine. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Deterministic tracking ID generator using the seeded PRNG. */
function deterministicTrackingId(prefix: string, r: () => number): string {
  const pfx = normalisePrefix(prefix);
  let body = "";
  for (let i = 0; i < TRACKING_BODY_LENGTH; i++) {
    body += TRACKING_ALPHABET[Math.floor(r() * TRACKING_ALPHABET.length)];
  }
  return `${pfx}-${body}`;
}

const CITIES = [
  "Mumbai, MH",
  "Pune, MH",
  "Delhi, DL",
  "Gurugram, HR",
  "Bengaluru, KA",
  "Hyderabad, TS",
  "Chennai, TN",
  "Ahmedabad, GJ",
  "Surat, GJ",
  "Kolkata, WB",
  "Jaipur, RJ",
  "Indore, MP",
  "Nagpur, MH",
  "Kochi, KL",
  "Lucknow, UP",
  "Coimbatore, TN",
  "Ludhiana, PB",
  "Guwahati, AS",
];

const CLIENT_NAMES = [
  "Shreeji Textiles Pvt Ltd",
  "Nova Electronics India",
  "Krishna Agro Exports",
  "Vertex Auto Components",
  "Meera Pharma Distributors",
  "Sunrise Furnishings",
  "Orbit Industrial Tools",
  "Aarna Home Appliances",
  "Deshmukh Steel Traders",
  "Bluewave Packaging",
  "Rajlaxmi Chemicals",
  "Trinetra Electricals",
  "Anand Dairy Foods",
  "Sahyadri Plastics",
  "Kavya Cosmetics",
  "Indus Machine Tools",
  "Rajdhani Stationers",
  "Silverline Ceramics",
  "Prakash Hardware Mart",
  "Ekta Footwear Co",
  "Mahalaxmi Spices",
  "Chandra Scientific Works",
  "Vardhman Paper Mills",
  "Sagar Marine Exports",
  "Nakshatra Jewellers",
  "Zenith Lab Supplies",
];

const CONTACT_FIRST = ["Amit", "Ravi", "Suresh", "Kiran", "Deepak", "Anita", "Meena", "Farhan", "Sanjay", "Pooja"];
const CONTACT_LAST = ["Shah", "Patel", "Reddy", "Gupta", "Joshi", "Menon", "Bose", "Chauhan", "Kaur", "Rao"];

const USER_SEED: Array<{ name: string; role: Role; email: string; phone: string }> = [
  { name: "Aarav Mehta", role: "owner", email: "aarav@fivelogistics.in", phone: "+91 98200 41122" },
  { name: "Priya Nair", role: "admin", email: "priya@fivelogistics.in", phone: "+91 98200 41133" },
  { name: "Rohit Kulkarni", role: "ops_manager", email: "rohit@fivelogistics.in", phone: "+91 98200 41144" },
  { name: "Sneha Iyer", role: "dispatcher", email: "sneha@fivelogistics.in", phone: "+91 98200 41155" },
  { name: "Vikram Desai", role: "accounts", email: "vikram@fivelogistics.in", phone: "+91 98200 41166" },
  { name: "Neha Sharma", role: "sales", email: "neha@fivelogistics.in", phone: "+91 98200 41177" },
  { name: "Imran Qureshi", role: "viewer", email: "imran@fivelogistics.in", phone: "+91 98200 41188" },
];

const CARRIER_SEED: Array<{
  code: Carrier["code"];
  adapter: Carrier["adapter"];
  priority: number;
  webhook: boolean;
  url: string | null;
}> = [
  {
    code: "DHL",
    adapter: "mock",
    priority: 1,
    webhook: true,
    url: "https://www.dhl.com/in-en/home/tracking.html?tracking-id={id}",
  },
  {
    code: "SAFEXPRESS",
    adapter: "mock",
    priority: 2,
    webhook: false,
    url: "https://www.safexpress.com/track/{id}",
  },
  { code: "BLUEDART", adapter: "bluedart", priority: 3, webhook: true, url: "https://www.bluedart.com/tracking/{id}" },
  { code: "DTDC", adapter: "dtdc", priority: 4, webhook: true, url: "https://www.dtdc.in/tracking/tracking_results.asp?strCnno={id}" },
  { code: "OM", adapter: "mock", priority: 5, webhook: false, url: "https://www.omlogistics.co.in/track/{id}" },
  { code: "GATI", adapter: "mock", priority: 6, webhook: false, url: null },
  { code: "OTHER", adapter: "mock", priority: 7, webhook: false, url: null },
];

const CHECKPOINT_LABELS: Record<string, string[]> = {
  pickup: ["Pickup scheduled", "Consignment picked up"],
  warehouse: ["Reached origin hub", "Bagged and dispatched"],
  in_transit: ["In transit", "Arrived at destination hub"],
  delivered: ["Out for delivery", "Delivered"],
  delayed: ["Delayed at hub", "Awaiting carrier clearance"],
};

const DELAY_REASONS = ["Weather", "Carrier backlog", "Address issue", "Vehicle breakdown", "Customs hold"];

const LEAD_COMPANIES = [
  "Pinnacle Electricals",
  "Ganesh Traders",
  "Nordic Cables India",
  "Sri Balaji Foods",
  "Quantum Robotics",
  "Hari Om Enterprises",
  "Lotus Retail Group",
  "Vayu Renewables",
  "Crest Ceramics",
  "Deccan Beverages",
  "Omkar Engineering",
  "Brightline Papers",
];

export const DEMO = {
  tenantId: "tnt_5lx",
  slug: "five-logistics",
  clientIdPrefix: "cli",
  carrierIdPrefix: "car",
  shipmentIdPrefix: "shp",
  leadIdPrefix: "led",
  invoiceIdPrefix: "inv",
  userIdPrefix: "usr",
  jobIdPrefix: "job",
} as const;

export interface DemoDataset {
  tenant: Tenant;
  users: UserDTO[];
  carriers: Carrier[];
  clients: ClientDTO[];
  shipments: ShipmentDTO[];
  checkpoints: CheckpointDTO[];
  leads: LeadDTO[];
  leadActivities: LeadActivityDTO[];
  invoices: InvoiceDTO[];
  invoiceLines: InvoiceLineDTO[];
  notifications: NotificationDTO[];
  auditEvents: AuditEventDTO[];
  jobs: JobDTO[];
  /** Instant the dataset was generated against — pass a fixed value in tests. */
  now: number;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

const refOf = (prefix: string, index: number): string => `${prefix}_${pad(index, 4)}`;

function cityOf(r: () => number): string {
  return CITIES[Math.floor(r() * CITIES.length)]!;
}

function personOf(r: () => number): string {
  return `${CONTACT_FIRST[Math.floor(r() * CONTACT_FIRST.length)]!} ${CONTACT_LAST[Math.floor(r() * CONTACT_LAST.length)]!}`;
}

function gstinOf(r: () => number): string {
  const state = pad(Math.floor(r() * 37) + 1, 2);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let mid = "";
  for (let i = 0; i < 5; i += 1) mid += letters[Math.floor(r() * letters.length)];
  return `${state}${mid}${pad(Math.floor(r() * 9999), 4)}${letters[Math.floor(r() * letters.length)]}1Z${Math.floor(r() * 9)}`;
}

// ── entities ────────────────────────────────────────────────────────────────

export function demoTenant(now = Date.now()): Tenant {
  return {
    id: DEMO.tenantId,
    slug: DEMO.slug,
    companyName: "Five Logistics",
    productName: "Five Logistics",
    tagline: "Freight you can track end to end",
    trackingPrefix: "5LX",
    supportEmail: "support@fivelogistics.in",
    themePrimary: "#0284c7",
    themePrimaryDark: "#0ea5e9",
    themeAccent: "#0284c7",
    themeSidebarBg: "#0c4a6e",
    timezone: "Asia/Kolkata",
    currency: "INR",
    plan: "standard",
    maskPolicy: "last2",
    publicTrackingEnabled: true,
    delayReasons: [...DELAY_REASONS],
    leadSources: [...LEAD_SOURCES],
    createdAt: now - 420 * DAY,
  };
}

function demoUsers(tenant: Tenant, now: number): UserDTO[] {
  return USER_SEED.map((seed, index) => ({
    id: refOf(DEMO.userIdPrefix, index + 1),
    tenantId: tenant.id,
    name: seed.name,
    email: seed.email,
    phone: seed.phone,
    role: seed.role,
    avatarUrl: null,
    active: true,
    lastLoginAt: now - (index + 1) * 5 * HOUR,
    invitedBy: index === 0 ? null : refOf(DEMO.userIdPrefix, 1),
    createdAt: tenant.createdAt + (index + 1) * DAY,
  }));
}

export function asUserRef(user: UserDTO): UserRef {
  return { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl ?? null };
}

function demoCarriers(tenant: Tenant, shipments: ShipmentDTO[], now: number): Carrier[] {
  const openByCode = new Map<string, number>();
  for (const shipment of shipments) {
    if (shipment.status !== "delivered") {
      openByCode.set(shipment.carrier.code, (openByCode.get(shipment.carrier.code) ?? 0) + 1);
    }
  }
  return CARRIER_SEED.map((seed, index) => ({
    id: refOf(DEMO.carrierIdPrefix, index + 1),
    tenantId: tenant.id,
    code: seed.code,
    name: seed.code === "DHL" ? "DHL Express" : seed.code === "BLUEDART" ? "BlueDart Express" : seed.code === "SAFEXPRESS" ? "Safexpress Pvt Ltd" : seed.code === "DTDC" ? "DTDC Express" : seed.code === "OM" ? "OM Logistics" : seed.code === "GATI" ? "Gati KWE" : "Other carrier",
    adapter: CARRIER_ADAPTERS.includes(seed.adapter) ? seed.adapter : "mock",
    trackingUrlTemplate: seed.url,
    supportsWebhook: seed.webhook,
    active: index < 6,
    priority: seed.priority,
    openShipments: openByCode.get(seed.code) ?? 0,
    createdAt: tenant.createdAt + (index + 1) * 3 * DAY,
  }));
}

function demoClients(tenant: Tenant, shipments: ShipmentDTO[], invoices: InvoiceDTO[], now: number): ClientDTO[] {
  const r = rng(20260913);
  return CLIENT_NAMES.map((name, index) => {
    const clientId = refOf(DEMO.clientIdPrefix, index + 1);
    const mine = shipments.filter((s) => s.client.id === clientId);
    const outstanding = invoices
      .filter((i) => i.client.id === clientId && i.status !== "paid")
      .reduce((sum, i) => sum + i.totalPaise, 0);
    return {
      id: clientId,
      tenantId: tenant.id,
      name,
      contactName: personOf(r),
      email: `accounts@${name.toLowerCase().replace(/[^a-z]+/g, "")}.in`.slice(0, 48),
      phone: `+91 9${pad(Math.floor(r() * 100000000), 8)}`,
      gstin: gstinOf(r),
      addressLine1: `${Math.floor(r() * 90) + 1}, ${["Industrial Estate", "MIDC Phase II", "Transport Nagar", "Market Yard", "Logistics Park"][Math.floor(r() * 5)]}`,
      addressLine2: null,
      city: CITIES[index % CITIES.length]!.split(",")[0]!,
      state: CITIES[index % CITIES.length]!.split(",")[1]!.trim(),
      pincode: `${Math.floor(r() * 8) + 1}${pad(Math.floor(r() * 99999), 5)}`.slice(0, 6),
      creditTermsDays: [15, 30, 45][index % 3],
      active: index % 13 !== 0,
      shipmentCount: mine.length,
      outstandingPaise: outstanding,
      createdAt: tenant.createdAt + (index + 2) * 2 * DAY,
    };
  });
}

function buildShipments(
  tenant: Tenant,
  users: UserDTO[],
  clients: ClientDTO[],
  carriers: Carrier[],
  now: number,
): { shipments: ShipmentDTO[]; checkpoints: CheckpointDTO[] } {
  const r = rng(5150713);
  const shipments: ShipmentDTO[] = [];
  const checkpoints: CheckpointDTO[] = [];
  const assignable = users.filter((u) => ["owner", "admin", "ops_manager", "dispatcher"].includes(u.role));
  const carriersByActivity = carriers.filter((c) => c.active);
  const total = 168;

  for (let index = 1; index <= total; index += 1) {
    const client = clients[Math.floor(r() * clients.length)]!;
    const carrier = carriersByActivity[Math.floor(r() * carriersByActivity.length)]!;
    const createdAt = now - Math.floor(r() * 120) * DAY - Math.floor(r() * 20) * HOUR;
    const ageDays = (now - createdAt) / DAY;
    const roll = r();
    // Older consignments are mostly closed; fresh ones are mostly in flight.
    const status: ShipmentStatus =
      ageDays > 45
        ? roll < 0.9
          ? "delivered"
          : "delayed"
        : ageDays > 18
          ? roll < 0.6
            ? "delivered"
            : roll < 0.75
              ? "delayed"
              : "in_transit"
          : roll < 0.18
            ? "pickup"
            : roll < 0.34
              ? "warehouse"
              : roll < 0.82
                ? "in_transit"
                : roll < 0.9
                  ? "delivered"
                  : "delayed";

    const serviceLevel = (["surface", "air", "express"] as const)[Math.floor(r() * 3)]!;
    const transitDays = serviceLevel === "surface" ? 5 : serviceLevel === "air" ? 3 : 2;
    const expectedDelivery = createdAt + transitDays * DAY;
    const delayed = status === "delayed";
    const deliveredAt = status === "delivered" ? Math.min(now, expectedDelivery - Math.floor(r() * 12) * HOUR) : null;
    const lastEventAt = deliveredAt ?? createdAt + Math.min(ageDays, 4) * DAY;
    const assignee = assignable[Math.floor(r() * assignable.length)]!;
    const creator = assignable[Math.floor(r() * assignable.length)]!;
    const hasCarrierId = carrier.code !== "GATI" && carrier.code !== "OTHER";
    const trackingId = deterministicTrackingId(tenant.trackingPrefix, r);
    const carrierTrackingId = hasCarrierId
      ? `${carrier.code.slice(0, 2)}${pad(Math.floor(r() * 9_999_999), 7)}`
      : null;
    const syncState = !hasCarrierId ? "manual" : delayed ? "error" : r() < 0.7 ? "synced" : "stale";
    const origin = cityOf(r);
    let destination = cityOf(r);
    if (destination === origin) destination = CITIES[(CITIES.indexOf(origin) + 3) % CITIES.length]!;

    const shipmentId = refOf(DEMO.shipmentIdPrefix, index);
    const ship: ShipmentDTO = {
      id: shipmentId,
      tenantId: tenant.id,
      trackingId: asMaskedValue(trackingId, tenant.maskPolicy),
      carrierTrackingId: asMaskedValue(carrierTrackingId, "first2_last2"),
      carrierTrackingIdSetAt: carrierTrackingId ? createdAt + 6 * HOUR : null,
      client: { id: client.id, name: client.name },
      carrier: { id: carrier.id, code: carrier.code, name: carrier.name },
      route: {
        origin,
        destination,
        originPincode: client.pincode ?? null,
        destinationPincode: null,
      },
      referenceNumber: `PO-2026-${pad(index, 4)}`,
      invoiceNumber: r() < 0.7 ? formatInvoiceNumber(2026, index) : null,
      packages: 1 + Math.floor(r() * 11),
      weightGrams: 500 + Math.floor(r() * 44_500),
      declaredValuePaise: (5_000 + Math.floor(r() * 400_000)) * 100,
      serviceLevel,
      paymentMode: (["prepaid", "cod", "to_pay"] as const)[Math.floor(r() * 3)]!,
      status,
      assignedTo: r() < 0.85 ? asUserRef(assignee) : null,
      createdBy: asUserRef(creator),
      createdAt,
      updatedAt: lastEventAt + HOUR,
      expectedDelivery,
      deliveredAt,
      delayReason: delayed ? DELAY_REASONS[Math.floor(r() * DELAY_REASONS.length)]! : null,
      notes:
        r() < 0.3
          ? ["Handle with care — fragile consignment.", "Client asked for delivery before 2 pm.", "Call receiver 30 minutes before arrival.", "Fragile: glassware inside."][Math.floor(r() * 4)]!
          : null,
      lastSyncedAt: syncState === "manual" ? null : lastEventAt + 2 * HOUR,
      syncState,
      isOverdue: status !== "delivered" && expectedDelivery < now,
    };

    // Checkpoints walk the legal chain up to the current status.
    const chain: ShipmentStatus[] = status === "delayed" ? ["pickup", "warehouse", "delayed"] : status === "pickup" ? ["pickup"] : status === "warehouse" ? ["pickup", "warehouse"] : status === "in_transit" ? ["pickup", "warehouse", "in_transit"] : ["pickup", "warehouse", "in_transit", "delivered"];
    let step = 0;
    for (const chainStatus of chain) {
      const labels = CHECKPOINT_LABELS[chainStatus]!;
      const label = labels[Math.min(step, labels.length - 1)]!;
      const occurredAt = createdAt + step * (6 + Math.floor(r() * 14)) * HOUR;
      const at = Math.min(occurredAt, now - 30 * 60_000);
      const automatic = step > 0 && r() < 0.55;
      checkpoints.push({
        id: `chk_${pad(index, 4)}_${step}`,
        shipmentId,
        status: chainStatus,
        label,
        location: step === 0 ? origin : step >= chain.length - 1 ? destination : cityOf(r),
        note: r() < 0.2 ? "Scanned at facility." : null,
        delayReason: chainStatus === "delayed" ? ship.delayReason ?? null : null,
        occurredAt: at,
        recordedAt: at + (automatic ? 5 * 60_000 : 30 * 60_000),
        source: automatic ? (carrier.supportsWebhook ? "carrier_webhook" : "carrier_poll") : "manual",
        byUserId: automatic ? null : assignee.id,
        byUserName: automatic ? null : assignee.name,
      });
      step += 1;
    }
    ship.checkpointCount = step;
    shipments.push(ship);
  }

  return { shipments, checkpoints };
}

function buildLeads(tenant: Tenant, users: UserDTO[], clients: ClientDTO[], now: number): { leads: LeadDTO[]; leadActivities: LeadActivityDTO[] } {
  const r = rng(881177);
  const leads: LeadDTO[] = [];
  const leadActivities: LeadActivityDTO[] = [];
  const sales = users.filter((u) => ["owner", "admin", "sales", "ops_manager"].includes(u.role));
  const weights: Array<LeadDTO["status"]> = ["new", "new", "new", "contacted", "contacted", "negotiation", "negotiation", "won", "lost"];

  for (let index = 1; index < 43; index += 1) {
    const status = weights[Math.floor(r() * weights.length)]!;
    const createdAt = now - Math.floor(r() * 75) * DAY;
    const owner = sales[Math.floor(r() * sales.length)]!;
    const company = LEAD_COMPANIES[index % LEAD_COMPANIES.length]!;
    const converted = status === "won" ? clients[Math.floor(r() * clients.length)]! : null;
    const leadId = refOf(DEMO.leadIdPrefix, index);
    const followUpDay = Math.floor(r() * 6) - 1;
    const lead: LeadDTO = {
      id: leadId,
      tenantId: tenant.id,
      name: personOf(r),
      company,
      email: `contact@${company.toLowerCase().replace(/[^a-z]+/g, "")}.in`.slice(0, 46),
      phone: `+91 9${pad(Math.floor(r() * 100000000), 8)}`,
      source: LEAD_SOURCES[Math.floor(r() * LEAD_SOURCES.length)]!,
      status,
      assignedTo: r() < 0.9 ? asUserRef(owner) : null,
      notes: r() < 0.4 ? "Wants monthly rate card before deciding." : null,
      nextFollowUp: status === "won" || status === "lost" ? null : now + followUpDay * DAY + 11 * HOUR,
      expectedValuePaise: (10_000 + Math.floor(r() * 240_000)) * 100,
      convertedClientId: converted?.id ?? null,
      createdAt,
      updatedAt: now - Math.floor(r() * 6) * DAY,
    };

    const count = 1 + Math.floor(r() * 5);
    for (let step = 0; step < count; step += 1) {
      const kind = (["note", "call", "email", "status_change"] as const)[Math.floor(r() * 4)]!;
      const author = r() < 0.85 ? owner : sales[Math.floor(r() * sales.length)]!;
      leadActivities.push({
        id: `act_${pad(index, 4)}_${step}`,
        leadId,
        kind,
        text:
          kind === "call"
            ? "Discussed volume for next quarter; asked for a revised quote."
            : kind === "email"
              ? "Sent rate card and service-level options."
              : kind === "status_change"
                ? `Moved to ${status}.`
                : "Client prefers surface service to keep costs down.",
        byUserId: author.id,
        byUserName: author.name,
        createdAt: createdAt + step * DAY + 3 * HOUR,
      });
    }
    lead.activityCount = count;
    leads.push(lead);
  }

  return { leads, leadActivities };
}

function buildInvoices(tenant: Tenant, clients: ClientDTO[], shipments: ShipmentDTO[], now: number): { invoices: InvoiceDTO[]; invoiceLines: InvoiceLineDTO[] } {
  const r = rng(424242);
  const invoices: InvoiceDTO[] = [];
  const invoiceLines: InvoiceLineDTO[] = [];
  const billable = shipments.filter((s) => s.status === "delivered");

  for (let index = 1; index < 97; index += 1) {
    const client = clients[Math.floor(r() * clients.length)]!;
    const invoiceId = refOf(DEMO.invoiceIdPrefix, index);
    const issueDate = now - Math.floor(r() * 110) * DAY;
    const terms = client.creditTermsDays ?? 30;
    const dueDate = issueDate + terms * DAY;
    const roll = r();
    const status: InvoiceDTO["status"] = issueDate + terms * DAY < now ? (roll < 0.72 ? "paid" : "overdue") : roll < 0.35 ? "paid" : "pending";
    const lineCount = 1 + Math.floor(r() * 3);

    let subtotalPaise = 0;
    let taxPaise = 0;
    const lines: InvoiceLineDTO[] = [];
    for (let line = 0; line < lineCount; line += 1) {
      const shipment = billable[Math.floor(r() * Math.max(1, billable.length))];
      const amountPaise = (1_200 + Math.floor(r() * 28_000)) * 100;
      const taxRateBp = 1800;
      const lineTax = Math.round((amountPaise * taxRateBp) / 10_000);
      subtotalPaise += amountPaise;
      taxPaise += lineTax;
      lines.push({
        id: `invl_${pad(index, 4)}_${line}`,
        invoiceId,
        shipmentId: shipment?.id ?? null,
        shipmentTrackingId: shipment ? shipment.trackingId.value : null,
        description: shipment
          ? `Freight charges — ${shipment.route.origin.split(",")[0]} to ${shipment.route.destination.split(",")[0]} (${shipment.serviceLevel})`
          : "Freight charges",
        amountPaise,
        taxRateBp,
      });
    }
    invoiceLines.push(...lines);

    const totals = computeInvoiceTotals(
      lines.map((l) => ({ amountPaise: l.amountPaise, taxRateBp: l.taxRateBp })),
    );

    invoices.push({
      id: invoiceId,
      tenantId: tenant.id,
      number: formatInvoiceNumber(2026, index),
      client: { id: client.id, name: client.name },
      status,
      subtotalPaise: totals.subtotalPaise,
      taxPaise: totals.taxPaise,
      totalPaise: totals.totalPaise,
      currency: "INR",
      issueDate,
      dueDate,
      paidAt: status === "paid" ? issueDate + Math.floor(r() * terms) * DAY : null,
      notes: r() < 0.15 ? "Payable by NEFT to the account on the invoice." : null,
      createdAt: issueDate,
      updatedAt: status === "paid" ? issueDate + Math.floor(r() * terms) * DAY : issueDate,
      lineCount,
      lines,
      shipments: lines
        .filter((l) => l.shipmentId && l.shipmentTrackingId)
        .map((l) => ({ id: l.shipmentId!, trackingId: l.shipmentTrackingId! })),
      isOverdue: status !== "paid" && dueDate < now,
    });
  }

  return { invoices, invoiceLines };
}

function buildNotifications(tenant: Tenant, users: UserDTO[], shipments: ShipmentDTO[], invoices: InvoiceDTO[], leads: LeadDTO[], now: number): NotificationDTO[] {
  const r = rng(9090);
  const dispatcher = users.find((u) => u.role === "dispatcher")!;
  const accounts = users.find((u) => u.role === "accounts")!;
  const ops = users.find((u) => u.role === "ops_manager")!;
  const delayed = shipments.filter((s) => s.status === "delayed");
  const overdue = invoices.filter((i) => i.status === "overdue");
  const types: NotificationType[] = ["delay", "milestone", "invoice", "assignment", "system"];
  const out: NotificationDTO[] = [];

  for (let index = 0; index < 22; index += 1) {
    const type = types[index % types.length]!;
    const shipment = delayed[Math.floor(r() * Math.max(1, delayed.length))];
    const invoice = overdue[Math.floor(r() * Math.max(1, overdue.length))];
    const lead = leads[Math.floor(r() * leads.length)]!;
    const createdAt = now - Math.floor(r() * 5) * DAY - Math.floor(r() * 20) * HOUR;
    const kind = type as NotificationType;
    out.push({
      id: `ntf_${pad(index + 1, 4)}`,
      tenantId: tenant.id,
      userId: kind === "invoice" ? accounts.id : kind === "assignment" ? ops.id : null,
      type: kind,
      title:
        kind === "delay"
          ? `${shipment?.trackingId.value ?? "A consignment"} is delayed`
          : kind === "milestone"
            ? "Consignment delivered"
            : kind === "invoice"
              ? `${invoice?.number ?? "An invoice"} is overdue`
              : kind === "assignment"
                ? "New work assigned to you"
                : "Nightly sync completed",
      message:
        kind === "delay"
          ? `${shipment?.carrier.name ?? "Carrier"} reported ${shipment?.delayReason ?? "a delay"} on the ${shipment?.route.destination ?? "route"} leg.`
          : kind === "milestone"
            ? "The receiver signed for the consignment; all checkpoints are recorded."
            : kind === "invoice"
              ? `${invoice?.client.name ?? "Client"} has ${invoice ? formatInvoiceNumber(2026, index) : "an invoice"} past its due date.`
              : kind === "assignment"
                ? `${dispatcher.name} assigned ${lead.company} to you for follow-up.`
                : "Carrier statuses were pulled for all open consignments.",
      shipmentId: kind === "delay" || kind === "milestone" ? shipment?.id ?? null : null,
      invoiceId: kind === "invoice" ? invoice?.id ?? null : null,
      readAt: index % 3 === 0 ? null : createdAt + 2 * HOUR,
      createdAt,
      channelsSent: kind === "system" ? ["inapp"] : ["inapp", "email"],
    });
  }
  return out;
}

function buildAudit(tenant: Tenant, users: UserDTO[], shipments: ShipmentDTO[], invoices: InvoiceDTO[], now: number): AuditEventDTO[] {
  const r = rng(31337);
  const events: AuditEventDTO[] = [];
  const templates: Array<{ action: string; entityType: AuditEventDTO["entityType"]; severity: AuditEventDTO["severity"]; summary: (label: string) => string }> = [
    { action: "shipment.created", entityType: "shipment", severity: "info", summary: (l) => `Created consignment ${l}` },
    { action: "shipment.status_changed", entityType: "shipment", severity: "info", summary: (l) => `Status changed on ${l}` },
    { action: "checkpoint.logged", entityType: "checkpoint", severity: "info", summary: (l) => `Logged a checkpoint on ${l}` },
    { action: "checkpoint.received", entityType: "checkpoint", severity: "info", summary: (l) => `Carrier webhook checkpoint on ${l}` },
    { action: "shipment.synced", entityType: "shipment", severity: "info", summary: (l) => `Synced carrier status for ${l}` },
    { action: "shipment.sync_failed", entityType: "shipment", severity: "warn", summary: (l) => `Carrier sync failed for ${l}` },
    { action: "shipment.carrier_tracking_set", entityType: "tracking", severity: "info", summary: (l) => `Carrier tracking number recorded for ${l}` },
    { action: "tracking.revealed", entityType: "tracking", severity: "warn", summary: (l) => `Full tracking ID revealed for ${l}` },
    { action: "tracking.copied", entityType: "tracking", severity: "info", summary: (l) => `Tracking ID copied for ${l}` },
    { action: "invoice.created", entityType: "invoice", severity: "info", summary: (l) => `Created invoice ${l}` },
    { action: "invoice.overdue_flagged", entityType: "invoice", severity: "warn", summary: (l) => `Invoice ${l} crossed its due date` },
    { action: "client.created", entityType: "client", severity: "info", summary: (l) => `Added client ${l}` },
    { action: "lead.converted", entityType: "lead", severity: "info", summary: (l) => `Converted lead ${l}` },
    { action: "settings.brand_updated", entityType: "settings", severity: "info", summary: () => "Updated white-label branding" },
    { action: "team.invited", entityType: "team", severity: "info", summary: (l) => `Invited ${l} to the workspace` },
    { action: "auth.login_succeeded", entityType: "auth", severity: "info", summary: (l) => `${l} signed in` },
    { action: "auth.login_failed", entityType: "auth", severity: "warn", summary: (l) => `Failed sign-in for ${l}` },
    { action: "system.job_run", entityType: "system", severity: "info", summary: (l) => `Ran scheduled job ${l}` },
    { action: "export.requested", entityType: "export", severity: "info", summary: (l) => `Exported ${l}` },
  ];
  const openShipments = shipments;
  let stamp = now - 26 * DAY;

  for (let index = 0; index < 340; index += 1) {
    const template = templates[Math.floor(r() * templates.length)]!;
    const actor = users[Math.floor(r() * users.length)]!;
    const shipment = openShipments[Math.floor(r() * openShipments.length)]!;
    const invoice = invoices[Math.floor(r() * invoices.length)]!;
    const machine = r() < 0.12;
    const target = template.entityType === "invoice" ? invoice.number : template.entityType === "settings" || template.entityType === "auth" ? actor.name : shipment.trackingId.value;
    const entityLabel = template.entityType === "invoice" ? invoice.number : template.entityType === "settings" || template.entityType === "system" || template.entityType === "export" ? (template.entityType === "system" ? "carrier_status_sync" : template.entityType === "export" ? "shipments.csv" : "brand") : shipment.trackingId.value;
    stamp += Math.floor(r() * 3 * HOUR) + 5 * 60_000;
    events.push({
      id: `aud_${pad(index + 1, 5)}`,
      tenantId: tenant.id,
      occurredAt: Math.min(stamp, Date.now() - 60_000),
      actorType: machine ? "system" : "user",
      actorId: machine ? null : actor.id,
      actorName: machine ? "System" : actor.name,
      actorAvatarUrl: null,
      action: template.action,
      entityType: template.entityType,
      entityId: template.entityType === "invoice" ? invoice.id : template.entityType === "shipment" || template.entityType === "checkpoint" || template.entityType === "tracking" ? shipment.id : DEMO.tenantId,
      entityLabel,
      severity: template.severity,
      summary: template.summary(target),
      changes:
        template.action === "shipment.status_changed"
          ? { status: { from: "in_transit", to: shipment.status } }
          : template.action === "settings.brand_updated"
            ? { themePrimary: { from: "#0ea5e9", to: "#0284c7" } }
            : null,
      ip: machine ? null : `49.36.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}`,
      userAgent: machine ? "logiflow-worker/2.0" : "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      requestId: `req_${pad(index + 1, 6)}`,
      source: machine ? (r() < 0.5 ? "job" : "webhook") : r() < 0.9 ? "web" : "api",
    });
  }
  return events.sort((a, b) => b.occurredAt - a.occurredAt);
}

function buildJobs(tenant: Tenant, shipments: ShipmentDTO[], now: number): JobDTO[] {
  const r = rng(777);
  const types: JobType[] = ["carrier_status_sync", "delayed_detection", "eta_recompute", "invoice_overdue_sweep", "notification_dispatch", "lead_follow_up_reminder", "audit_retention"];
  const jobs: JobDTO[] = [];
  for (let index = 0; index < 16; index += 1) {
    const type = types[index % types.length]!;
    const status = index < 2 ? "queued" : index === 3 ? "running" : index === 7 ? "failed" : "done";
    const runAt = index < 3 ? now + (index + 1) * 15 * 60_000 : now - (index + 1) * 3 * HOUR;
    jobs.push({
      id: refOf(DEMO.jobIdPrefix, index + 1),
      tenantId: tenant.id,
      type,
      payload:
        type === "carrier_status_sync"
          ? { shipmentId: shipments[index % shipments.length]!.id, carrierId: shipments[index % shipments.length]!.carrier.id }
          : type === "delayed_detection"
            ? { windowHours: 6 }
            : null,
      runAt,
      attempts: status === "failed" ? 3 : 1,
      lastError: status === "failed" ? "Carrier adapter timed out after 10s" : null,
      status,
      naturalKey: `${type}:${new Date(runAt).toISOString().slice(0, 10)}`,
      createdAt: runAt - 10 * 60_000,
    });
  }
  return jobs;
}

/** The whole workspace, generated deterministically for a given instant. */
export function demoDataset(now: number = Date.now()): DemoDataset {
  const tenant = demoTenant(now);
  const users = demoUsers(tenant, now);
  const draftClients = demoClients(tenant, [], [], now);
  const carriers = demoCarriers(tenant, [], now);
  const { shipments, checkpoints } = buildShipments(tenant, users, draftClients, carriers, now);
  const carriersWithLoad = demoCarriers(tenant, shipments, now);
  const draftWithLoad = demoClients(tenant, shipments, [], now);
  const { invoices, invoiceLines } = buildInvoices(tenant, draftWithLoad, shipments, now);
  const clients = demoClients(tenant, shipments, invoices, now);
  const { leads, leadActivities } = buildLeads(tenant, users, clients, now);
  const notifications = buildNotifications(tenant, users, shipments, invoices, leads, now);
  const auditEvents = buildAudit(tenant, users, shipments, invoices, now);
  const jobs = buildJobs(tenant, shipments, now);

  return {
    tenant,
    users,
    carriers: carriersWithLoad,
    clients,
    shipments: shipments.map((s) => ({
      ...s,
      carrier: { ...s.carrier, name: carriersWithLoad.find((c) => c.code === s.carrier.code)!.name },
    })),
    checkpoints,
    leads,
    leadActivities,
    invoices,
    invoiceLines,
    notifications,
    auditEvents,
    jobs,
    now,
  };
}

/** Who the mock-mode session is signed in as; the live app reads the cookie. */
export function demoSession(role: Role = "owner", now: number = Date.now()): SessionResponse {
  const tenant = demoTenant(now);
  const users = demoUsers(tenant, now);
  const user = users.find((u) => u.role === role) ?? users[0]!;
  const scopes: Partial<Record<Permission, Grant>> = {};
  for (const permission of permissionsFor(role)) {
    scopes[permission] = grantFor(role, permission);
  }
  return {
    user,
    role,
    permissions: permissionsFor(role),
    tenant,
    scopes: scopes as Record<Permission, Grant>,
    themePref: "system",
    notificationPrefs: {
      delay: ["inapp", "email"],
      milestone: ["inapp"],
      invoice: ["inapp", "email"],
      assignment: ["inapp"],
      system: ["inapp"],
    },
  };
}

/** KPI cards the dashboard renders (§14.2) — computed from the same dataset. */
export function demoKpis(dataset: DemoDataset): KpiCard[] {
  const open = dataset.shipments.filter((s) => s.status !== "delivered");
  const deliveredThisMonth = dataset.shipments.filter(
    (s) => s.deliveredAt && s.deliveredAt > dataset.now - 30 * DAY,
  );
  const delayed = dataset.shipments.filter((s) => s.status === "delayed");
  const outstanding = dataset.invoices.filter((i) => i.status !== "paid");
  const spark = (base: number, seed: number): number[] => {
    const r = rng(seed);
    return Array.from({ length: 14 }, () => Math.max(0, Math.round(base * (0.6 + r() * 0.8))));
  };
  return [
    {
      id: "open_shipments",
      label: "Open consignments",
      value: open.length,
      format: "count",
      deltaPercent: 6.4,
      direction: "up",
      tone: "accent",
      sparkline: spark(open.length / 14, 11),
      href: "/shipments?status=open",
    },
    {
      id: "delivered_30d",
      label: "Delivered (30 days)",
      value: deliveredThisMonth.length,
      format: "count",
      deltaPercent: 12.1,
      direction: "up",
      tone: "success",
      sparkline: spark(deliveredThisMonth.length / 14, 12),
      href: "/shipments?status=delivered",
    },
    {
      id: "delayed",
      label: "Delayed now",
      value: delayed.length,
      format: "count",
      deltaPercent: -8.2,
      direction: "down",
      tone: "warn",
      sparkline: spark(Math.max(1, delayed.length / 14), 13),
      href: "/shipments?status=delayed",
    },
    {
      id: "non_delivery_rate",
      label: "On-time rate",
      value: dataset.shipments.length
        ? Math.round(((dataset.shipments.length - delayed.length) / dataset.shipments.length) * 1000) / 10
        : 100,
      format: "percent",
      deltaPercent: 1.3,
      direction: "up",
      tone: "default",
      sparkline: spark(92, 14),
      href: "/analytics",
    },
    {
      id: "outstanding",
      label: "Outstanding receivables",
      value: outstanding.reduce((sum, i) => sum + i.totalPaise, 0),
      format: "money",
      deltaPercent: -4.6,
      direction: "down",
      tone: "destructive",
      sparkline: spark(60, 15),
      href: "/invoices?status=overdue",
    },
    {
      id: "active_clients",
      label: "Active clients",
      value: dataset.clients.filter((c) => c.active).length,
      format: "count",
      deltaPercent: 3.1,
      direction: "up",
      tone: "default",
      sparkline: spark(24, 16),
      href: "/clients",
    },
  ];
}

export const DAY_MS = DAY;
export const HOUR_MS = HOUR;
export const SHIPMENT_STATUS_LIST = SHIPMENT_STATUSES;
export const SHIPMENT_STATUS_TEXT = SHIPMENT_STATUS_LABELS;
export const SYNC_STATE_TEXT = SYNC_STATE_LABELS;
