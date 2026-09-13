/**
 * DB integration tests — shipment status transitions, audit writes,
 * append-only triggers, row-scope filtering, masking, bulk operations,
 * invoice creation totals, CSV export, idempotency replay.
 *
 * Uses a TEMP SQLite file; never touches the dev DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import * as schema from "../schema/index.js";
import { shipments, checkpoints, auditEvents, clients, users, carriers } from "../schema/index.js";
import { recordAudit } from "../audit.js";
import { assertTransition } from "../services/shipments.js";
import { SHIPMENT_STATUS_ORDER, type ShipmentStatus } from "@logiflow/contracts";
import { newId } from "@logiflow/shared";

// ── Test database setup ──────────────────────────────────────────────────────
const testDir = mkdtempSync(join(tmpdir(), "logiflow-test-"));
const dbPath = join(testDir, "test.db");

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const TENANT_ID = "tnt_test";
const USER_ID = "usr_test_0001";
const CLIENT_ID = "cli_test_0001";
const CARRIER_ID = "car_test_0001";
const NOW = Date.now();

function setupTestDb() {
  sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");

  // Apply the migration SQL
  const migrationPath = join(__dirname, "../../migrations/0000_init.sql");
  const sql = readFileSync(migrationPath, "utf-8");
  sqlite.exec(sql);

  db = drizzle(sqlite, { schema });

  // Seed minimal data for FK constraints
  sqlite.prepare(`
    INSERT INTO tenants (id, slug, company_name, product_name, tracking_prefix, delay_reasons, lead_sources, created_at, updated_at)
    VALUES (?, 'test-tenant', 'Test Co', 'LogiFlow', 'TL', '["Traffic"]', '["Referral"]', ?, ?)
  `).run(TENANT_ID, NOW, NOW);

  sqlite.prepare(`
    INSERT INTO users (id, tenant_id, name, email, role, password_hash, created_at, updated_at)
    VALUES (?, ?, 'Test User', 'test@test.com', 'owner', 'hash', ?, ?)
  `).run(USER_ID, TENANT_ID, NOW, NOW);

  sqlite.prepare(`
    INSERT INTO clients (id, tenant_id, name, created_by, created_at, updated_at)
    VALUES (?, ?, 'Test Client', ?, ?, ?)
  `).run(CLIENT_ID, TENANT_ID, USER_ID, NOW, NOW);

  sqlite.prepare(`
    INSERT INTO carriers (id, tenant_id, code, name, adapter, active, priority, created_at, updated_at)
    VALUES (?, ?, 'DTDC', 'DTDC Express', 'mock', 1, 1, ?, ?)
  `).run(CARRIER_ID, TENANT_ID, NOW, NOW);
}

beforeAll(() => {
  setupTestDb();
});

afterAll(() => {
  sqlite?.close();
  rmSync(testDir, { recursive: true, force: true });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function insertShipment(status: ShipmentStatus, extra: Record<string, unknown> = {}): string {
  const id = newId();
  const now = Date.now();
  sqlite.prepare(`
    INSERT INTO shipments (id, tenant_id, tracking_id, carrier_id, client_id, origin, destination, packages, weight_grams, service_level, payment_mode, status, created_by, created_at, updated_at, expected_delivery, delay_reason, assigned_to)
    VALUES (?, ?, ?, ?, ?, 'Mumbai', 'Delhi', 1, 1000, 'surface', 'prepaid', ?, ?, ?, ?, ?, ?, ?)
  `).run(id, TENANT_ID, `TL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, CARRIER_ID, CLIENT_ID, status, USER_ID, now, now, now + 86400000, extra.delayReason ?? null, extra.assignedTo ?? USER_ID);
  return id;
}

function countAuditEvents(tenantId: string): number {
  const row = sqlite.prepare("SELECT COUNT(*) as cnt FROM audit_events WHERE tenant_id = ?").get(tenantId) as { cnt: number };
  return row.cnt;
}

// ── Shipment status transitions ──────────────────────────────────────────────
describe("shipment status transitions (assertTransition)", () => {
  it("allows legal forward path: pickup → warehouse", () => {
    expect(() => assertTransition("pickup", "warehouse")).not.toThrow();
  });

  it("allows legal forward path: warehouse → in_transit", () => {
    expect(() => assertTransition("warehouse", "in_transit")).not.toThrow();
  });

  it("allows legal forward path: in_transit → delivered", () => {
    expect(() => assertTransition("in_transit", "delivered")).not.toThrow();
  });

  it("allows full chain: pickup → warehouse → in_transit → delivered", () => {
    let current: ShipmentStatus = "pickup";
    for (const next of ["warehouse", "in_transit", "delivered"]) {
      expect(() => assertTransition(current, next as ShipmentStatus)).not.toThrow();
      current = next as ShipmentStatus;
    }
  });

  it("rejects illegal jump: pickup → delivered (skipping steps)", () => {
    expect(() => assertTransition("pickup", "delivered")).toThrow();
  });

  it("rejects illegal jump: pickup → in_transit (skipping warehouse)", () => {
    expect(() => assertTransition("pickup", "in_transit")).toThrow();
  });

  it("delivered is terminal — no transition out", () => {
    expect(() => assertTransition("delivered", "in_transit")).toThrow();
    expect(() => assertTransition("delivered", "pickup")).toThrow();
    expect(() => assertTransition("delivered", "delayed")).toThrow();
  });

  it("delayed is reachable from any non-delivered status", () => {
    const nonDelivered: ShipmentStatus[] = ["pickup", "warehouse", "in_transit"];
    for (const from of nonDelivered) {
      expect(() => assertTransition(from, "delayed", "Traffic congestion")).not.toThrow();
    }
  });

  it("delayed requires a delayReason", () => {
    expect(() => assertTransition("pickup", "delayed")).toThrow();
    expect(() => assertTransition("pickup", "delayed", "Traffic congestion")).not.toThrow();
  });

  it("delayed can recover to any on-path status", () => {
    for (const to of SHIPMENT_STATUS_ORDER) {
      expect(() => assertTransition("delayed", to)).not.toThrow();
    }
  });

  it("backward moves (corrections) are allowed for on-path statuses", () => {
    expect(() => assertTransition("in_transit", "warehouse")).not.toThrow();
    expect(() => assertTransition("warehouse", "pickup")).not.toThrow();
    expect(() => assertTransition("in_transit", "pickup")).not.toThrow();
  });

  it("delivered → anything is rejected (delivered is terminal)", () => {
    // delivered is terminal per the implementation, even for "corrections"
    expect(() => assertTransition("delivered", "pickup")).toThrow();
  });

  it("same-status is a no-op", () => {
    expect(() => assertTransition("in_transit", "in_transit")).not.toThrow();
  });
});

// ── Audit writes via drizzle ─────────────────────────────────────────────────
describe("audit writes", () => {
  it("recordAudit inserts a row and returns the ID", () => {
    const countBefore = countAuditEvents(TENANT_ID);
    const auditId = recordAudit(db, {
      userId: USER_ID,
      tenantId: TENANT_ID,
      name: "Test User",
      email: "test@test.com",
      role: "owner",
      permissions: [],
      requestId: "req_test_001",
      source: "web",
      reveal: false,
    }, {
      action: "shipment.status_changed",
      entityType: "shipment",
      entityId: "shp_test",
      entityLabel: "TL-ABC123",
      summary: "Status changed to Delayed",
      severity: "warn",
    });
    expect(auditId).toBeDefined();
    expect(typeof auditId).toBe("string");
    expect(countAuditEvents(TENANT_ID)).toBe(countBefore + 1);
  });

  it("audit row has correct fields", () => {
    const row = sqlite.prepare("SELECT * FROM audit_events ORDER BY rowid DESC LIMIT 1").get() as Record<string, unknown>;
    expect(row.tenant_id).toBe(TENANT_ID);
    expect(row.actor_name).toBe("Test User");
    expect(row.action).toBe("shipment.status_changed");
    expect(row.entity_type).toBe("shipment");
    expect(row.entity_id).toBe("shp_test");
    expect(row.severity).toBe("warn");
  });
});

// ── Audit triggers — append-only ────────────────────────────────────────────
describe("audit_events append-only triggers", () => {
  it("UPDATE is rejected by the trigger", () => {
    // First, insert a row
    const id = newId();
    sqlite.prepare(`
      INSERT INTO audit_events (id, tenant_id, occurred_at, actor_type, actor_name, action, entity_type, entity_id, entity_label, severity, summary, request_id, source)
      VALUES (?, ?, ?, 'user', 'Test', 'system.job_run', 'system', 'test', 'test', 'info', 'Test', 'req_test', 'job')
    `).run(id, TENANT_ID, Date.now());

    // Attempt UPDATE — should throw
    expect(() => {
      sqlite.prepare("UPDATE audit_events SET summary = 'HACKED' WHERE id = ?").run(id);
    }).toThrow(/append-only/);
  });

  it("DELETE is rejected by the trigger", () => {
    const id = newId();
    sqlite.prepare(`
      INSERT INTO audit_events (id, tenant_id, occurred_at, actor_type, actor_name, action, entity_type, entity_id, entity_label, severity, summary, request_id, source)
      VALUES (?, ?, ?, 'user', 'Test', 'system.job_run', 'system', 'test', 'test', 'info', 'Test', 'req_test', 'job')
    `).run(id, TENANT_ID, Date.now());

    expect(() => {
      sqlite.prepare("DELETE FROM audit_events WHERE id = ?").run(id);
    }).toThrow(/append-only/);
  });

  it("row count is unchanged after failed UPDATE and DELETE", () => {
    const countBefore = countAuditEvents(TENANT_ID);
    // Attempt operations that should fail
    try {
      sqlite.prepare("UPDATE audit_events SET summary = 'HACKED' WHERE 1=1").run();
    } catch { /* expected */ }
    try {
      sqlite.prepare("DELETE FROM audit_events WHERE 1=1").run();
    } catch { /* expected */ }
    expect(countAuditEvents(TENANT_ID)).toBe(countBefore);
  });
});

// ── Row-scope filtering (direct SQL) ────────────────────────────────────────
describe("row-scope filtering", () => {
  const ownerUserId = "usr_owner_001";
  const dispatcherUserId = "usr_disp_001";
  const assignedShipmentId = "shp_assigned_001";
  const otherShipmentId = "shp_other_001";

  beforeAll(() => {
    // Create users
    sqlite.prepare(`
      INSERT OR IGNORE INTO users (id, tenant_id, name, email, role, password_hash, created_at, updated_at)
      VALUES (?, ?, 'Owner', 'owner@test.com', 'owner', 'hash', ?, ?)
    `).run(ownerUserId, TENANT_ID, NOW, NOW);
    sqlite.prepare(`
      INSERT OR IGNORE INTO users (id, tenant_id, name, email, role, password_hash, created_at, updated_at)
      VALUES (?, ?, 'Dispatcher', 'disp@test.com', 'dispatcher', 'hash', ?, ?)
    `).run(dispatcherUserId, TENANT_ID, NOW, NOW);

    // Create shipments: one assigned to dispatcher, one assigned to owner
    sqlite.prepare(`
      INSERT OR IGNORE INTO shipments (id, tenant_id, tracking_id, carrier_id, client_id, origin, destination, packages, weight_grams, service_level, payment_mode, status, created_by, assigned_to, created_at, updated_at, expected_delivery)
      VALUES (?, ?, 'TL-AAA111', ?, ?, 'Mumbai', 'Delhi', 1, 1000, 'surface', 'prepaid', 'pickup', ?, ?, ?, ?, ?)
    `).run(assignedShipmentId, TENANT_ID, CARRIER_ID, CLIENT_ID, ownerUserId, dispatcherUserId, NOW, NOW, NOW + 86400000);

    sqlite.prepare(`
      INSERT OR IGNORE INTO shipments (id, tenant_id, tracking_id, carrier_id, client_id, origin, destination, packages, weight_grams, service_level, payment_mode, status, created_by, assigned_to, created_at, updated_at, expected_delivery)
      VALUES (?, ?, 'TL-BBB222', ?, ?, 'Pune', 'Kolkata', 1, 2000, 'air', 'prepaid', 'in_transit', ?, ?, ?, ?, ?)
    `).run(otherShipmentId, TENANT_ID, CARRIER_ID, CLIENT_ID, ownerUserId, ownerUserId, NOW, NOW, NOW + 86400000);
  });

  it("owner sees all shipments (no assigned_to filter)", () => {
    // Simulate: owner has shipment:read_all = 'all'
    const rows = sqlite.prepare(`
      SELECT id FROM shipments WHERE tenant_id = ? AND deleted_at IS NULL
    `).all(TENANT_ID) as Array<{ id: string }>;
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(assignedShipmentId);
    expect(ids).toContain(otherShipmentId);
  });

  it("dispatcher sees only assigned shipments", () => {
    // Simulate: dispatcher has shipment:read_assigned, filter assigned_to = dispatcherUserId
    const rows = sqlite.prepare(`
      SELECT id FROM shipments WHERE tenant_id = ? AND deleted_at IS NULL AND assigned_to = ?
    `).all(TENANT_ID, dispatcherUserId) as Array<{ id: string }>;
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(assignedShipmentId);
    expect(ids).not.toContain(otherShipmentId);
  });
});

// ── Bulk operations (direct SQL) ────────────────────────────────────────────
describe("bulk assign", () => {
  it("updates assigned_to for multiple shipments", () => {
    const id1 = insertShipment("pickup");
    const id2 = insertShipment("pickup");
    const newAssignee = "usr_new_001";

    sqlite.prepare(`
      UPDATE shipments SET assigned_to = ?, updated_at = ? WHERE id IN (?, ?)
    `).run(newAssignee, Date.now(), id1, id2);

    const r1 = sqlite.prepare("SELECT assigned_to FROM shipments WHERE id = ?").get(id1) as { assigned_to: string };
    const r2 = sqlite.prepare("SELECT assigned_to FROM shipments WHERE id = ?").get(id2) as { assigned_to: string };
    expect(r1.assigned_to).toBe(newAssignee);
    expect(r2.assigned_to).toBe(newAssignee);
  });
});

// ── Invoice creation totals ──────────────────────────────────────────────────
describe("invoice totals (computed in application layer)", () => {
  it("computeInvoiceTotals matches line sums", async () => {
    const { computeInvoiceTotals } = await import("@logiflow/shared");
    const lines = [
      { amountPaise: 500000, taxRateBp: 1800 },
      { amountPaise: 300000, taxRateBp: 1800 },
    ];
    const totals = computeInvoiceTotals(lines);
    expect(totals.subtotalPaise).toBe(800000);
    expect(totals.taxPaise).toBe(144000);
    expect(totals.totalPaise).toBe(944000);
  });
});

// ── CSV export content ───────────────────────────────────────────────────────
describe("CSV export (using shared csv module)", () => {
  it("toCsv produces correct output", async () => {
    const { toCsv } = await import("@logiflow/shared");
    const rows = [
      { trackingId: "TL-AAA111", status: "pickup" },
      { trackingId: "TL-BBB222", status: "in_transit" },
    ];
    const csv = toCsv(rows, [
      { id: "trackingId", header: "Tracking ID", value: (r) => r.trackingId },
      { id: "status", header: "Status", value: (r) => r.status },
    ]);
    expect(csv).toContain("Tracking ID,Status");
    expect(csv).toContain("TL-AAA111,pickup");
    expect(csv).toContain("TL-BBB222,in_transit");
  });
});

// ── Idempotency replay ──────────────────────────────────────────────────────
describe("idempotency", () => {
  it("inserting the same idempotency key twice is rejected by UNIQUE constraint", () => {
    const key = `idemp_${Date.now()}`;
    sqlite.prepare(`
      INSERT INTO idempotency_keys (id, tenant_id, key, route, request_hash, expires_at, created_at)
      VALUES (?, ?, ?, '/shipments', 'hash', ?, ?)
    `).run(newId(), TENANT_ID, key, NOW + 86400000, NOW);

    expect(() => {
      sqlite.prepare(`
        INSERT INTO idempotency_keys (id, tenant_id, key, route, request_hash, expires_at, created_at)
        VALUES (?, ?, ?, '/shipments', 'hash', ?, ?)
      `).run(newId(), TENANT_ID, key, NOW + 86400000, NOW);
    }).toThrow();
  });
});

// ── Masking in shipments (via shared module) ─────────────────────────────────
describe("masking integration", () => {
  it("maskTrackingId masks a real tracking ID", async () => {
    const { maskTrackingId } = await import("@logiflow/shared");
    const masked = maskTrackingId("TL-ABC123");
    expect(masked).not.toBe("TL-ABC123");
    expect(masked).toContain("•");
  });
});
