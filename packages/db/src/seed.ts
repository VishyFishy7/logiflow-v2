/**
 * Seed the demo dataset into the live SQLite database.
 *
 * Driven by `demoDataset(now)` from @logiflow/contracts — the SAME generator
 * that feeds MSW in mock mode — so every screen has identical data in both
 * deployment modes (PRD §9.3).
 *
 * Design choices:
 *   - **Idempotent**: on every run, deletes ALL rows (respecting FK order),
 *     re-applies migrations (recreating audit triggers), then inserts fresh.
 *     This is simpler and safer than upserts because (a) cuid2 PKs change
 *     every generation, (b) the DTO has fields (isOverdue, openShipments)
 *     that don't live in the DB, and (c) the audit triggers reject UPDATE/DELETE
 *     so we drop+recreate them during the clean phase.
 *   - **Password hashing**: uses `hashPassword` from the same auth service
 *     (`packages/db/src/services/auth.ts`) so a live sign-in works.
 *   - **Sequence seeding**: sets `sequences.value` to one past the highest
 *     seeded invoice number so the next `mintInvoiceNumber()` call won't collide.
 */
import { demoDataset, DEMO_PASSWORD, type DemoDataset } from "@logiflow/contracts";
import { hashPassword } from "./services/auth.js";
import { db, sqlite } from "./client.js";
import * as schema from "./schema/index.js";
import { newId } from "@logiflow/shared";

// ── Run migrations first ────────────────────────────────────────────────────
// Reuse the migration runner inline (it's only 10 lines) so the seed script
// is a single self-contained command.
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
execSync(`node --import tsx ${resolve(here, "migrate.ts")}`, {
  stdio: "inherit",
  cwd: resolve(here, "../.."),
});

// ── Drop & recreate audit triggers (needed to delete rows for idempotent re-seed) ──
sqlite.exec("DROP TRIGGER IF EXISTS audit_events_no_update");
sqlite.exec("DROP TRIGGER IF EXISTS audit_events_no_delete");

// ── Delete all rows in FK-safe order ────────────────────────────────────────
const tables = [
  "notification_deliveries",
  "notifications",
  "invoice_lines",
  "invoices",
  "checkpoints",
  "shipments",
  "lead_activities",
  "leads",
  "audit_events",
  "jobs",
  "sessions",
  "accounts",
  "invite_tokens",
  "carriers",
  "clients",
  "users",
  "sequences",
  "tenants",
] as const;

sqlite.exec("PRAGMA foreign_keys = OFF");
for (const table of tables) {
  sqlite.exec(`DELETE FROM ${table}`);
}
sqlite.exec("PRAGMA foreign_keys = ON");

// ── Recreate audit triggers ─────────────────────────────────────────────────
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS audit_events_no_update
  BEFORE UPDATE ON audit_events
  BEGIN
    SELECT RAISE(ABORT, 'audit_events is append-only: UPDATE is rejected');
  END;
`);
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
  BEFORE DELETE ON audit_events
  BEGIN
    SELECT RAISE(ABORT, 'audit_events is append-only: DELETE is rejected');
  END;
`);

// ── Generate demo dataset ───────────────────────────────────────────────────
const now = Date.now();
const dataset = demoDataset(now);

// ── Helper: raw tracking IDs map (fixtures mask them; we need raw for DB) ────
// Re-generate deterministic raw tracking IDs from the same fixture logic:
// the demoDataset creates 168 shipments, each with a random body. Since the
// fixture uses crypto randomness and we can't reverse-mask, we generate fresh
// IDs that are equally valid. The public tracking page resolves by raw ID,
// so we must store raw IDs in the DB.
//
// NOTE: The fixtures' `generateTrackingId` uses crypto.getRandomValues which
// is non-deterministic. For the seed we store the carrier_tracking_id's raw
// value (which is NOT masked in the DB) and for tracking_id we generate a new
// raw ID. This means the DB tracking IDs will differ from mock-mode's masked
// display — but the public tracking page reads from the DB, not mock data.
function generateRawTrackingId(prefix: string): string {
  const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
  const normalizedPrefix = prefix.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 5);
  let body = "";
  for (let i = 0; i < 6; i++) {
    body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${normalizedPrefix}-${body}`;
}

// Build a mapping of shipment index → raw tracking ID (deterministic via seed)
const rawTrackingIds: string[] = [];
{
  const PREFIX = dataset.tenant.trackingPrefix;
  const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
  // Use a simple seeded PRNG so IDs are reproducible across runs
  let seed = 92_345_678; // deterministic seed for reproducible raw tracking IDs
  function nextRand(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }
  for (let i = 0; i < dataset.shipments.length; i++) {
    let body = "";
    for (let j = 0; j < 6; j++) {
      body += ALPHABET[Math.floor(nextRand() * ALPHABET.length)];
    }
    rawTrackingIds.push(`${PREFIX}-${body}`);
  }
}

// ── Hash passwords ──────────────────────────────────────────────────────────
const passwordHash = hashPassword(DEMO_PASSWORD);

// ── Insert everything in one synchronous transaction ─────────────────────────
// better-sqlite3 transaction callback MUST be synchronous (no await).
db.transaction((tx) => {
  // 1. Tenants
  const t = dataset.tenant;
  tx.insert(schema.tenants).values({
    id: t.id,
    slug: t.slug,
    companyName: t.companyName,
    productName: t.productName,
    tagline: t.tagline,
    trackingPrefix: t.trackingPrefix,
    supportEmail: t.supportEmail,
    themePrimary: t.themePrimary,
    themePrimaryDark: t.themePrimaryDark,
    themeAccent: t.themeAccent,
    themeSidebarBg: t.themeSidebarBg,
    timezone: t.timezone,
    currency: t.currency,
    plan: t.plan,
    maskPolicy: t.maskPolicy,
    publicTrackingEnabled: t.publicTrackingEnabled,
    delayReasons: JSON.stringify(t.delayReasons),
    leadSources: JSON.stringify(t.leadSources),
    inviteOnly: false,
    auditRetentionMonths: 24,
    createdAt: t.createdAt,
    updatedAt: t.createdAt,
  }).run();

  // 2. Users
  for (const u of dataset.users) {
    tx.insert(schema.users).values({
      id: u.id,
      tenantId: u.tenantId,
      name: u.name,
      email: u.email,
      phone: u.phone ?? null,
      role: u.role,
      avatarUrl: null,
      passwordHash,
      active: u.active,
      lastLoginAt: u.lastLoginAt ?? null,
      invitedBy: u.invitedBy ?? null,
      themePref: null,
      notificationPrefs: null,
      sidebarCollapsed: false,
      failedLogins: 0,
      lockedUntil: null,
      createdAt: u.createdAt,
      updatedAt: u.createdAt,
    }).run();
  }

  // 3. Clients
  for (const c of dataset.clients) {
    tx.insert(schema.clients).values({
      id: c.id,
      tenantId: c.tenantId,
      name: c.name,
      contactName: c.contactName ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      gstin: c.gstin ?? null,
      addressLine1: c.addressLine1 ?? null,
      addressLine2: c.addressLine2 ?? null,
      city: c.city ?? null,
      state: c.state ?? null,
      pincode: c.pincode ?? null,
      creditTermsDays: c.creditTermsDays ?? null,
      active: c.active,
      createdBy: null,
      createdAt: c.createdAt,
      updatedAt: c.createdAt,
    }).run();
  }

  // 4. Carriers
  for (const c of dataset.carriers) {
    tx.insert(schema.carriers).values({
      id: c.id,
      tenantId: c.tenantId,
      code: c.code,
      name: c.name,
      adapter: c.adapter,
      trackingUrlTemplate: c.trackingUrlTemplate ?? null,
      webhookSecretRef: null,
      webhookSecret: null,
      supportsWebhook: c.supportsWebhook,
      active: c.active,
      priority: c.priority,
      createdAt: c.createdAt,
      updatedAt: c.createdAt,
    }).run();
  }

  // 5. Shipments (with raw tracking IDs)
  for (let i = 0; i < dataset.shipments.length; i++) {
    const s = dataset.shipments[i]!;
    const rawTrackingId = rawTrackingIds[i]!;
    tx.insert(schema.shipments).values({
      id: s.id,
      tenantId: s.tenantId,
      trackingId: rawTrackingId,
      carrierTrackingId: s.carrierTrackingId.masked
        ? null  // The raw carrier ID is not available in masked mode; store null
        : (s.carrierTrackingId.value === "—" ? null : s.carrierTrackingId.value),
      carrierTrackingIdSetAt: s.carrierTrackingIdSetAt ?? null,
      clientId: s.client.id,
      carrierId: s.carrier.id,
      referenceNumber: s.referenceNumber ?? null,
      origin: s.route.origin,
      destination: s.route.destination,
      originPincode: s.route.originPincode ?? null,
      destinationPincode: s.route.destinationPincode ?? null,
      invoiceNumber: s.invoiceNumber ?? null,
      packages: s.packages,
      weightGrams: s.weightGrams,
      declaredValuePaise: s.declaredValuePaise ?? null,
      serviceLevel: s.serviceLevel,
      paymentMode: s.paymentMode,
      status: s.status,
      assignedTo: s.assignedTo?.id ?? null,
      createdBy: s.createdBy?.id ?? s.createdBy?.name ?? "system",
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      expectedDelivery: s.expectedDelivery,
      deliveredAt: s.deliveredAt ?? null,
      delayReason: s.delayReason ?? null,
      notes: s.notes ?? null,
      lastSyncedAt: s.lastSyncedAt ?? null,
      syncState: s.syncState,
      syncFailures: 0,
      deletedAt: null,
      deletedBy: null,
    }).run();
  }

  // 6. Checkpoints
  for (const cp of dataset.checkpoints) {
    tx.insert(schema.checkpoints).values({
      id: cp.id,
      tenantId: dataset.tenant.id,
      shipmentId: cp.shipmentId,
      status: cp.status,
      label: cp.label,
      location: cp.location ?? null,
      note: cp.note ?? null,
      delayReason: cp.delayReason ?? null,
      occurredAt: cp.occurredAt,
      recordedAt: cp.recordedAt,
      source: cp.source,
      byUserId: cp.byUserId ?? null,
      byUserName: cp.byUserName ?? null,
      rawStatus: null,
      rawPayload: cp.rawPayload ? JSON.stringify(cp.rawPayload) : null,
      createdAt: cp.recordedAt,
    }).run();
  }

  // 7. Leads
  for (const l of dataset.leads) {
    tx.insert(schema.leads).values({
      id: l.id,
      tenantId: l.tenantId,
      name: l.name,
      company: l.company,
      email: l.email ?? null,
      phone: l.phone ?? null,
      source: l.source,
      status: l.status,
      assignedTo: l.assignedTo?.id ?? null,
      notes: l.notes ?? null,
      nextFollowUp: l.nextFollowUp ?? null,
      expectedValuePaise: l.expectedValuePaise ?? null,
      convertedClientId: l.convertedClientId ?? null,
      createdBy: dataset.users[0]!.id, // owner created all demo leads
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }).run();
  }

  // 8. Lead activities
  for (const la of dataset.leadActivities) {
    tx.insert(schema.leadActivities).values({
      id: la.id,
      tenantId: dataset.tenant.id,
      leadId: la.leadId,
      kind: la.kind,
      text: la.text,
      byUserId: la.byUserId ?? null,
      byUserName: la.byUserName ?? null,
      createdAt: la.createdAt,
    }).run();
  }

  // 9. Invoices
  for (const inv of dataset.invoices) {
    tx.insert(schema.invoices).values({
      id: inv.id,
      tenantId: inv.tenantId,
      number: inv.number,
      clientId: inv.client.id,
      status: inv.status,
      subtotalPaise: inv.subtotalPaise,
      taxPaise: inv.taxPaise,
      totalPaise: inv.totalPaise,
      currency: inv.currency,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt ?? null,
      notes: inv.notes ?? null,
      createdBy: dataset.users[0]!.id,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    }).run();
  }

  // 10. Invoice lines
  for (const il of dataset.invoiceLines) {
    tx.insert(schema.invoiceLines).values({
      id: il.id,
      tenantId: dataset.tenant.id,
      invoiceId: il.invoiceId,
      shipmentId: il.shipmentId ?? null,
      description: il.description,
      amountPaise: il.amountPaise,
      taxRateBp: il.taxRateBp,
      createdAt: dataset.tenant.createdAt,
    }).run();
  }

  // 11. Notifications
  for (const n of dataset.notifications) {
    tx.insert(schema.notifications).values({
      id: n.id,
      tenantId: n.tenantId,
      userId: n.userId ?? null,
      type: n.type,
      title: n.title,
      message: n.message,
      shipmentId: n.shipmentId ?? null,
      invoiceId: n.invoiceId ?? null,
      readAt: n.readAt ?? null,
      channelsSent: JSON.stringify(n.channelsSent),
      createdAt: n.createdAt,
    }).run();
  }

  // 12. Audit events (append-only after triggers are recreated)
  for (const ae of dataset.auditEvents) {
    tx.insert(schema.auditEvents).values({
      id: ae.id,
      tenantId: ae.tenantId,
      occurredAt: ae.occurredAt,
      actorType: ae.actorType,
      actorId: ae.actorId ?? null,
      actorName: ae.actorName,
      actorAvatarUrl: ae.actorAvatarUrl ?? null,
      action: ae.action,
      entityType: ae.entityType,
      entityId: ae.entityId,
      entityLabel: ae.entityLabel,
      severity: ae.severity,
      summary: ae.summary,
      changes: ae.changes ? JSON.stringify(ae.changes) : null,
      ip: ae.ip ?? null,
      userAgent: ae.userAgent ?? null,
      requestId: ae.requestId,
      source: ae.source,
    }).run();
  }

  // 13. Jobs (skip duplicates on natural_key via onConflictDoNothing)
  for (const j of dataset.jobs) {
    tx.insert(schema.jobs).values({
      id: j.id,
      tenantId: j.tenantId,
      type: j.type,
      payload: j.payload ? JSON.stringify(j.payload) : null,
      naturalKey: j.naturalKey,
      runAt: j.runAt,
      attempts: j.attempts,
      lastError: j.lastError ?? null,
      status: j.status,
      lockedAt: null,
      finishedAt: null,
      createdAt: j.createdAt,
    }).onConflictDoNothing().run();
  }

  // 14. Sequences — set to one past the highest seeded invoice number
  // Invoice numbers are INV-YYYY-NNNN where NNNN = dataset index + 1.
  // The highest index is 96 (dataset has 96 invoices, indices 1..96).
  const highestInvoiceSeq = dataset.invoices.length; // 96
  tx.insert(schema.sequences).values({
    id: newId(),
    tenantId: dataset.tenant.id,
    key: "invoice",
    year: 2026,
    value: highestInvoiceSeq,
  }).run();
});

console.log("\n✅ Seed complete — demo dataset inserted.\n");

// ── Per-table row count summary ─────────────────────────────────────────────
const countQueries = [
  ["tenants", "SELECT COUNT(*) as c FROM tenants"],
  ["users", "SELECT COUNT(*) as c FROM users"],
  ["clients", "SELECT COUNT(*) as c FROM clients"],
  ["carriers", "SELECT COUNT(*) as c FROM carriers"],
  ["shipments", "SELECT COUNT(*) as c FROM shipments"],
  ["checkpoints", "SELECT COUNT(*) as c FROM checkpoints"],
  ["leads", "SELECT COUNT(*) as c FROM leads"],
  ["lead_activities", "SELECT COUNT(*) as c FROM lead_activities"],
  ["invoices", "SELECT COUNT(*) as c FROM invoices"],
  ["invoice_lines", "SELECT COUNT(*) as c FROM invoice_lines"],
  ["notifications", "SELECT COUNT(*) as c FROM notifications"],
  ["audit_events", "SELECT COUNT(*) as c FROM audit_events"],
  ["jobs", "SELECT COUNT(*) as c FROM jobs"],
  ["sequences", "SELECT COUNT(*) as c FROM sequences"],
] as const;

console.log("📊 Row counts:");
let total = 0;
for (const [table, query] of countQueries) {
  const row = sqlite.prepare(query).get() as { c: number };
  total += row.c;
  console.log(`  ${table.padEnd(22)} ${String(row.c).padStart(5)}`);
}
console.log(`  ${"─".repeat(30)}`);
console.log(`  ${"TOTAL".padEnd(22)} ${String(total).padStart(5)}`);
console.log();
