/**
 * The only place that mints IDs. `text` primary keys holding a cuid2 (PRD §4.2)
 * — no auto-increment sequences, so the schema ports to Postgres untouched.
 */
import { createId } from "@paralleldrive/cuid2";

export function newId(): string {
  return createId();
}

/** Prefixed variants keep IDs self-describing in logs and fixtures. */
export function newPrefixedId(prefix: string): string {
  return `${prefix}_${createId().slice(0, 20)}`;
}

export function newRequestId(): string {
  return newPrefixedId("req");
}

export function newInviteToken(): string {
  return newPrefixedId("inv");
}

export function newStorageKey(filename: string): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(-40);
  return `${createId()}/${safe}`;
}

/** Human invoice number: `INV-2026-0042` (PRD §6.1, sequences table). */
export function formatInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${String(sequence).padStart(4, "0")}`;
}
