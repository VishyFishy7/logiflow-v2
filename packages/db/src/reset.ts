/**
 * Reset: delete the SQLite database file and re-run migrations + seed.
 *
 * Safety checks:
 *   - Refuses to run if DATABASE_URL points to a non-SQLite host (prod guard).
 *   - Only deletes files under the project `data/` directory.
 */
import { existsSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultDbPath = resolve(here, "../../../data/logiflow.db");

// ── Safety: refuse on production URLs ───────────────────────────────────────
const databaseUrl = process.env.DATABASE_URL ?? defaultDbPath;
if (databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://")) {
  console.error("❌ Refusing to reset: DATABASE_URL looks like a production Postgres host.");
  console.error("   Set DATABASE_URL to a SQLite path or unset it for local dev.");
  process.exit(1);
}

// Only delete SQLite files (file:… or .db/.sqlite paths)
const isSqlitePath =
  databaseUrl.startsWith("file:") || databaseUrl.endsWith(".db") || databaseUrl.endsWith(".sqlite");

if (!isSqlitePath) {
  console.error(`❌ Refusing to reset: DATABASE_URL doesn't look like a SQLite path: ${databaseUrl}`);
  process.exit(1);
}

const dbPath = databaseUrl.startsWith("file:")
  ? resolve(process.cwd(), databaseUrl.slice(5))
  : databaseUrl;

// Only delete if it's under the project data/ directory (safety net)
const projectDataDir = resolve(here, "../../../data");
if (!dbPath.startsWith(projectDataDir)) {
  console.error(`❌ Refusing to reset: DB path is outside the project data/ dir: ${dbPath}`);
  process.exit(1);
}

console.log(`🗑️  Deleting database: ${dbPath}`);
if (existsSync(dbPath)) {
  unlinkSync(dbPath);
  console.log("   ✅ Deleted.");
} else {
  console.log("   ℹ️  File didn't exist; nothing to delete.");
}

// Also delete WAL and SHM files that SQLite may have created
for (const suffix of ["-wal", "-shm"]) {
  const auxPath = dbPath + suffix;
  if (existsSync(auxPath)) {
    unlinkSync(auxPath);
    console.log(`   🗑️  Deleted auxiliary: ${auxPath}`);
  }
}

// ── Run migrations + seed ───────────────────────────────────────────────────
console.log("\n🔄 Running migrations...");
import("node:child_process").then(({ execSync }) => {
  execSync(`node --import tsx ${resolve(here, "migrate.ts")}`, {
    stdio: "inherit",
    cwd: resolve(here, "../.."),
  });

  console.log("\n🌱 Running seed...");
  execSync(`node --import tsx ${resolve(here, "seed.ts")}`, {
    stdio: "inherit",
    cwd: resolve(here, "../.."),
  });
});
