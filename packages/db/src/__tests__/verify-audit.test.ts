/**
 * Audit verification tests — exercise verify-audit.ts logic end to end
 * against a temp SQLite DB and assert a clean/immutable audit log.
 *
 * Tests the same trigger-based immutability that verify-audit.ts checks,
 * but against a temp DB (never touches the dev database).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const testDir = mkdtempSync(join(tmpdir(), "logiflow-verify-"));
const dbPath = join(testDir, "verify-test.db");

let sqlite: InstanceType<typeof Database>;

function auditCount(): number {
  const row = sqlite.prepare("SELECT COUNT(*) as cnt FROM audit_events").get() as { cnt: number };
  return row.cnt;
}

beforeAll(() => {
  sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");

  // Apply the migration SQL (includes the triggers)
  const migrationPath = join(__dirname, "../../migrations/0000_init.sql");
  const sql = readFileSync(migrationPath, "utf-8");
  sqlite.exec(sql);

  // Seed a tenant so FK constraints pass
  const now = Date.now();
  sqlite.prepare(`
    INSERT INTO tenants (id, slug, company_name, product_name, tracking_prefix, delay_reasons, lead_sources, created_at, updated_at)
    VALUES ('tnt_verify', 'verify-tenant', 'Verify Co', 'LogiFlow', 'VL', '["Other"]', '["Referral"]', ?, ?)
  `).run(now, now);
});

afterAll(() => {
  sqlite?.close();
  rmSync(testDir, { recursive: true, force: true });
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe("audit immutability (verify-audit logic)", () => {
  it("can count rows in the audit_events table", () => {
    const count = auditCount();
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("can INSERT into audit_events", () => {
    const id = `test_${Date.now()}_insert`;
    expect(() => {
      sqlite.prepare(`
        INSERT INTO audit_events (id, tenant_id, occurred_at, actor_type, actor_name, action, entity_type, entity_id, entity_label, severity, summary, request_id, source)
        VALUES (?, 'tnt_verify', ?, 'system', 'Test', 'system.job_run', 'system', 'test', 'test', 'info', 'Test row', 'req_test', 'job')
      `).run(id, Date.now());
    }).not.toThrow();
    expect(auditCount()).toBeGreaterThanOrEqual(1);
  });

  it("UPDATE is rejected by the audit_events_no_update trigger", () => {
    expect(() => {
      sqlite.prepare("UPDATE audit_events SET summary = 'HACKED' WHERE 1=1").run();
    }).toThrow(/append-only/);
  });

  it("DELETE is rejected by the audit_events_no_delete trigger", () => {
    expect(() => {
      sqlite.prepare("DELETE FROM audit_events WHERE 1=1").run();
    }).toThrow(/append-only/);
  });

  it("row count is unchanged after rejected UPDATE and DELETE", () => {
    const before = auditCount();
    try { sqlite.prepare("UPDATE audit_events SET summary = 'X' WHERE 1=1").run(); } catch { /* expected */ }
    try { sqlite.prepare("DELETE FROM audit_events WHERE 1=1").run(); } catch { /* expected */ }
    expect(auditCount()).toBe(before);
  });

  it("multiple INSERTs succeed (append-only works for inserts)", () => {
    const before = auditCount();
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      sqlite.prepare(`
        INSERT INTO audit_events (id, tenant_id, occurred_at, actor_type, actor_name, action, entity_type, entity_id, entity_label, severity, summary, request_id, source)
        VALUES (?, 'tnt_verify', ?, 'system', 'Test', 'system.job_run', 'system', 'test', 'test', 'info', 'Test', 'req_test', 'job')
      `).run(`test_${now}_${i}`, now + i);
    }
    expect(auditCount()).toBe(before + 5);
  });

  it("all rows have required fields non-null", () => {
    const rows = sqlite.prepare(`
      SELECT id, tenant_id, occurred_at, actor_type, actor_name, action, entity_type, entity_id, entity_label, severity, summary, request_id, source
      FROM audit_events
    `).all() as Array<Record<string, unknown>>;
    for (const row of rows) {
      expect(row.id).toBeTruthy();
      expect(row.tenant_id).toBeTruthy();
      expect(typeof row.occurred_at).toBe("number");
      expect(row.actor_type).toBeTruthy();
      expect(row.actor_name).toBeTruthy();
      expect(row.action).toBeTruthy();
      expect(row.entity_type).toBeTruthy();
      expect(row.entity_id).toBeTruthy();
      expect(row.entity_label).toBeTruthy();
      expect(row.severity).toBeTruthy();
      expect(row.summary).toBeTruthy();
      expect(row.request_id).toBeTruthy();
      expect(row.source).toBeTruthy();
    }
  });
});
