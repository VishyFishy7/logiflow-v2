/**
 * Forward-only migration runner. Deliberately not `drizzle-kit push`: the
 * audit-immutability triggers and the index set are part of the contract, so
 * the DDL that runs is the DDL under review in ./migrations.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { sqlite } from "./client.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "../migrations");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );
`);

const applied = new Set(
  sqlite.prepare("SELECT name FROM _migrations").all().map((row) => (row as { name: string }).name),
);

const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const body = readFileSync(join(migrationsDir, file), "utf8");
  const run = sqlite.transaction(() => {
    sqlite.exec(body);
    sqlite.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(file, Date.now());
  });
  run();
  count += 1;
  console.log(`applied ${file}`);
}

console.log(count === 0 ? "schema up to date" : `${count} migration(s) applied`);
