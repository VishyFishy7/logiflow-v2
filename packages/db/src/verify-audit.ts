/**
 * Verify audit event immutability: prove that UPDATE and DELETE on the
 * audit_events table are rejected by the SQLite triggers created in
 * the migration.
 */
import { sqlite } from "./client";

console.log("🔒 Verifying audit_events immutability...\n");

// 1. Count existing audit events
const before = (sqlite.prepare("SELECT COUNT(*) as c FROM audit_events").get() as { c: number }).c;
console.log(`  Current audit_events rows: ${before}`);

if (before === 0) {
  console.error("  ❌ No audit events found. Run the seed first.");
  process.exit(1);
}

// 2. Try UPDATE — should fail
const firstRow = sqlite.prepare("SELECT id FROM audit_events LIMIT 1").get() as { id: string };
try {
  sqlite.prepare("UPDATE audit_events SET summary = 'hacked' WHERE id = ?").run(firstRow.id);
  console.error("  ❌ UPDATE succeeded — triggers are BROKEN!");
  process.exit(1);
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("append-only")) {
    console.log("  ✅ UPDATE correctly rejected by trigger.");
  } else {
    console.error(`  ❌ UPDATE threw unexpected error: ${msg}`);
    process.exit(1);
  }
}

// 3. Try DELETE — should fail
try {
  sqlite.prepare("DELETE FROM audit_events WHERE id = ?").run(firstRow.id);
  console.error("  ❌ DELETE succeeded — triggers are BROKEN!");
  process.exit(1);
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("append-only")) {
    console.log("  ✅ DELETE correctly rejected by trigger.");
  } else {
    console.error(`  ❌ DELETE threw unexpected error: ${msg}`);
    process.exit(1);
  }
}

// 4. Verify count unchanged
const after = (sqlite.prepare("SELECT COUNT(*) as c FROM audit_events").get() as { c: number }).c;
if (after === before) {
  console.log(`  ✅ Row count unchanged: ${after}`);
} else {
  console.error(`  ❌ Row count changed: ${before} → ${after}`);
  process.exit(1);
}

// 5. Try INSERT — should succeed (use the actual tenant ID for FK compliance)
const tenantRow = sqlite.prepare("SELECT id FROM tenants LIMIT 1").get() as { id: string };
const testId = `audit_verify_${Date.now()}`;
try {
  sqlite.prepare(`
    INSERT INTO audit_events (id, tenant_id, occurred_at, actor_type, actor_name, action, entity_type, entity_id, entity_label, severity, summary, request_id, source)
    VALUES (?, ?, 0, 'system', 'Test', 'test.verify', 'system', 'test', 'test', 'info', 'verify probe', 'req_test', 'web')
  `).run(testId, tenantRow.id);
  console.log("  ✅ INSERT succeeded (append-only allows new rows).");

  // Note: we cannot delete this row (triggers block it). It stays as a harmless probe.
  const afterInsert = (sqlite.prepare("SELECT COUNT(*) as c FROM audit_events").get() as { c: number }).c;
  console.log(`  ✅ Row count after insert: ${afterInsert} (was ${after})`);
} catch (err: unknown) {
  console.error(`  ❌ INSERT failed unexpectedly: ${err}`);
  process.exit(1);
}

console.log("\n✅ All audit immutability checks passed.\n");
