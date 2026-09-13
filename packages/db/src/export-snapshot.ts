#!/usr/bin/env tsx
/**
 * Export snapshot — `db:export` command.
 *
 * Dumps the tenant's data to a timestamped directory with:
 *   - JSON per table (via toJsonLines() from @logiflow/shared)
 *   - A manifest with counts, request id, and actor
 *   - Redaction of password_hash, session tokens, etc.
 *
 * Output goes to data/exports/{timestamp}/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toJsonLines, REDACTED_LOG_PATHS } from "@logiflow/shared";
import { db, sqlite } from "./client";
import { tenants } from "./schema/index";

// ── Config ──────────────────────────────────────────────────────────────────

const here = process.cwd();

/** Fields that must never appear in export data. */
const REDACTED_FIELDS = new Set([
  "password_hash",
  "passwordHash",
  "token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "webhook_secret",
  "webhookSecret",
  "webhook_secret_ref",
  "webhookSecretRef",
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

function getAllRows(tableName: string): Record<string, unknown>[] {
  return sqlite.prepare(`SELECT * FROM ${tableName}`).all() as Record<string, unknown>[];
}

function redactRow(row: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (REDACTED_FIELDS.has(key)) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

function writeTable(
  exportDir: string,
  tableName: string,
): number {
  const rows = getAllRows(tableName).map(redactRow);
  if (rows.length > 0) {
    const jsonLines = toJsonLines(rows);
    writeFileSync(resolve(exportDir, `${tableName}.jsonl`), jsonLines, "utf8");
  }
  return rows.length;
}

// ── Export ──────────────────────────────────────────────────────────────────

interface ExportManifest {
  exportedAt: string;
  exportedAtMs: number;
  requestId: string;
  actor: string;
  tenantId: string;
  tableCounts: Record<string, number>;
  redactedFields: string[];
  notes: string;
}

export function exportSnapshot(
  tenantId: string,
  requestId: string,
  actor: string,
): string {
  const now = Date.now();
  const ts = new Date(now).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const exportDir = resolve(here, `data/exports/${ts}`);
  mkdirSync(exportDir, { recursive: true });

  const tableDefs: string[] = [
    "tenants",
    "users",
    "sessions",
    "accounts",
    "invite_tokens",
    "shipments",
    "checkpoints",
    "clients",
    "carriers",
    "leads",
    "lead_activities",
    "invoices",
    "invoice_lines",
    "notifications",
    "notification_deliveries",
    "audit_events",
    "jobs",
    "sequences",
    "idempotency_keys",
    "rate_limits",
    "attachments",
  ];

  const tableCounts: Record<string, number> = {};
  for (const tableName of tableDefs) {
    tableCounts[tableName] = writeTable(exportDir, tableName);
  }

  const manifest: ExportManifest = {
    exportedAt: new Date(now).toISOString(),
    exportedAtMs: now,
    requestId,
    actor,
    tenantId,
    tableCounts,
    redactedFields: [...REDACTED_FIELDS],
    notes: `Exported at ${new Date(now).toISOString()}. Password hashes, session tokens, and webhook secrets are redacted.`,
  };

  writeFileSync(
    resolve(exportDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  console.log(`Snapshot exported to ${exportDir}`);
  console.log(`Tables: ${Object.keys(tableCounts).length}`);
  console.log(`Redacted fields: ${[...REDACTED_FIELDS].join(", ")}`);

  return exportDir;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const tenantId = args[0] ?? "default";
  const requestId = args[1] ?? `export_${Date.now()}`;
  const actor = args[2] ?? "cli-export";

  exportSnapshot(tenantId, requestId, actor);
}

main();
