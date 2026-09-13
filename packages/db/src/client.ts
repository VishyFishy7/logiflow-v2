import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as schema from "./schema/index.js";

/**
 * Single writer. `better-sqlite3` is synchronous, which is a feature here: a
 * whole mutation (shipment + checkpoint + audit row) runs inside one
 * `db.transaction()` with no interleaving (§4.4).
 *
 * Note for contributors: with a synchronous driver, transaction callbacks must
 * not be `async` — drizzle rejects a promise-returning callback. Inside a
 * transaction use the sync builders (`.run()` / `.get()` / `.all()`); outside
 * one, `await` works normally.
 */
const here = dirname(fileURLToPath(import.meta.url));
const defaultPath = resolve(here, "../../../data/logiflow.db");

// Resolved from this module, not `process.cwd()`: the Next.js dev server runs
// with cwd = apps/web, and the database must not follow it.
const databaseUrl = process.env.DATABASE_URL ?? defaultPath;

mkdirSync(dirname(databaseUrl), { recursive: true });

export const sqlite = new Database(databaseUrl);

// WAL keeps readers (dashboards, the public tracking page) from blocking the
// writer; foreign keys are off by default in SQLite and must be asserted.
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("synchronous = NORMAL");

export const db = drizzle(sqlite, { schema });

export type Db = typeof db;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Repositories accept either the pool or an open transaction. */
export type Executor = Db | Tx;

export { schema };


/** Return the singleton drizzle client. */
export function getDb(): typeof db {
  return db;
}
