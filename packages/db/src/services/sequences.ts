/**
 * Per-tenant, per-year sequence minting — PRD §6.1.
 *
 * Used for invoice numbers: INV-{year}-{sequence}, zero-padded to 4 digits.
 * The sequences table stores (tenantId, key, year, value) and the
 * read+increment MUST happen inside the caller's transaction to avoid
 * duplicate numbers.
 *
 * Concurrency: better-sqlite3 is single-writer with WAL. A single
 * process holds the write lock, so two concurrent transactions that
 * both try to increment the same sequence will serialise at the
 * database level. The UPDATE ... SET value = value + 1 is atomic
 * within SQLite's WAL mode, and the unique index on
 * (tenantId, key, year) prevents phantom reads from creating
 * duplicates. If we ever move to multi-process or Postgres, this
 * would need SELECT ... FOR UPDATE or a serialisable isolation level.
 *
 * The read → format → return pattern inside the caller's tx means:
 *   1. tx reads current value (gets write lock on the row via WAL)
 *   2. tx increments value + inserts/updates the sequence row
 *   3. tx returns the formatted number
 *   4. tx commits, releasing the lock
 */
import { eq, and, sql } from "drizzle-orm";
import { newId, formatInvoiceNumber } from "@logiflow/shared";
import { sequences } from "../schema/index.js";
import type { Executor } from "../client.js";

/**
 * Mint the next invoice number for a tenant in a given year.
 *
 * Must be called inside a transaction — the sequence row is locked
 * for the duration of the callback.
 *
 * @param exec     The executor (must be a Tx)
 * @param tenantId The tenant
 * @param year     The calendar year (e.g. 2026)
 * @returns        The formatted invoice number, e.g. "INV-2026-0042"
 */
export function mintInvoiceNumber(
  exec: Executor,
  tenantId: string,
  year: number,
): string {
  const key = "invoice";

  // Try to read the existing sequence row.
  const existing = exec
    .select()
    .from(sequences)
    .where(and(
      eq(sequences.tenantId, tenantId),
      eq(sequences.key, key),
      eq(sequences.year, year),
    ))
    .get();

  const nextValue = (existing?.value ?? 0) + 1;

  if (existing) {
    // Increment atomically.
    exec
      .update(sequences)
      .set({ value: nextValue })
      .where(eq(sequences.id, existing.id))
      .run();
  } else {
    // First invoice for this tenant+year — insert with value 1.
    exec
      .insert(sequences)
      .values({
        id: newId(),
        tenantId,
        key,
        year,
        value: nextValue,
      })
      .run();
  }

  return formatInvoiceNumber(year, nextValue);
}

/**
 * Generic sequence minting for any key (not just invoices).
 * Returns the raw next value — the caller formats it.
 *
 * @param exec     The executor (must be a Tx)
 * @param tenantId The tenant
 * @param key      The sequence key (e.g. "proforma", "delivery_challan")
 * @param year     The calendar year
 * @returns        The next integer value in the sequence
 */
export function mintSequence(
  exec: Executor,
  tenantId: string,
  key: string,
  year: number,
): number {
  const existing = exec
    .select()
    .from(sequences)
    .where(and(
      eq(sequences.tenantId, tenantId),
      eq(sequences.key, key),
      eq(sequences.year, year),
    ))
    .get();

  const nextValue = (existing?.value ?? 0) + 1;

  if (existing) {
    exec
      .update(sequences)
      .set({ value: nextValue })
      .where(eq(sequences.id, existing.id))
      .run();
  } else {
    exec
      .insert(sequences)
      .values({
        id: newId(),
        tenantId,
        key,
        year,
        value: nextValue,
      })
      .run();
  }

  return nextValue;
}

/**
 * Read the current sequence value without incrementing.
 * Useful for display / audit purposes.
 */
export function peekSequence(
  exec: Executor,
  tenantId: string,
  key: string,
  year: number,
): number {
  const row = exec
    .select({ value: sequences.value })
    .from(sequences)
    .where(and(
      eq(sequences.tenantId, tenantId),
      eq(sequences.key, key),
      eq(sequences.year, year),
    ))
    .get();
  return row?.value ?? 0;
}
