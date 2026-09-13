import "server-only";

/**
 * Server-only singleton: re-uses the existing @logiflow/db client which opens
 * the SQLite file from `DATABASE_URL` (or the default `data/logiflow.db`).
 *
 * Every API route handler imports `getDb()` to get the drizzle instance.  The
 * DB client from @logiflow/db already configures WAL, foreign keys, and busy
 * timeout — we do not duplicate that here.
 */
import { db } from "@logiflow/db";

let _db: typeof db | null = null;

/** Return the singleton drizzle client. */
export function getDb(): typeof db {
  if (!_db) {
    _db = db;
  }
  return _db;
}
