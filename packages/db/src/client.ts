import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as schema from "./schema/index";

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

let _sqlite: InstanceType<typeof Database> | null = null;
export function getSqlite(): InstanceType<typeof Database> {
  if (!_sqlite) {
    _sqlite = new Database(databaseUrl);
    _sqlite.pragma("journal_mode = WAL");
    _sqlite.pragma("foreign_keys = ON");
    _sqlite.pragma("busy_timeout = 5000");
    _sqlite.pragma("synchronous = NORMAL");
  }
  return _sqlite;
}
export const sqlite: InstanceType<typeof Database> = new Proxy({} as InstanceType<typeof Database>, {
  get(_t, prop) {
    const s = getSqlite();
    const v = (s as unknown as Record<string, unknown>)[prop as string];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(s) : v;
  },
  set(_t, prop, value) {
    (getSqlite() as unknown as Record<string, unknown>)[prop as string] = value;
    return true;
  },
});

let _db: ReturnType<typeof drizzle> | null = null;
function getDbInternal(): ReturnType<typeof drizzle> {
  if (!_db) _db = drizzle(getSqlite(), { schema });
  return _db;
}
export const db: ReturnType<typeof drizzle> = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_t, prop) {
    const d = getDbInternal();
    const v = (d as unknown as Record<string, unknown>)[prop as string];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(d) : v;
  },
});

export type Db = ReturnType<typeof drizzle>;
export type Tx = Parameters<Parameters<ReturnType<typeof drizzle>["transaction"]>[0]>[0];
/** Repositories accept either the pool or an open transaction. */
export type Executor = Db | Tx;

export { schema };


/** Return the singleton drizzle client. */
export function getDb(): ReturnType<typeof drizzle> {
  return getDbInternal();
}
