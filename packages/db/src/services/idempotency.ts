/**
 * Request idempotency — PRD §9.8.
 *
 * For mutating endpoints: the client sends an `Idempotency-Key` header.
 * The server hashes (actor.userId, route, key) together with the
 * request body. On the first request, the response is stored. On
 * replay with the SAME body → the stored response is returned. On
 * replay with a DIFFERENT body → ApiError('IDEMPOTENCY_KEY_REUSED').
 *
 * Expired records are cleaned up lazily on each request and also
 * exposed for a periodic sweep.
 */
import { createHash } from "node:crypto";
import { eq, and, lt } from "drizzle-orm";
import { newId } from "@logiflow/shared";
import { idempotencyKeys } from "../schema/index.js";
import { ApiError } from "../errors.js";
import type { Executor } from "../client.js";

/** Default TTL: 24 hours (PRD §9.8). */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

// ── Hash helper ─────────────────────────────────────────────────────────────

function hashPayload(actorUserId: string, route: string, key: string, body: unknown): string {
  const raw = JSON.stringify({ actorUserId, route, key, body });
  return createHash("sha256").update(raw).digest("hex");
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface IdempotencyResult {
  /** true if this is a replay (stored response found). */
  replay: boolean;
  /** The stored response body string (only when replay=true). */
  responseBody?: string | null;
  /** The stored HTTP status code (only when replay=true). */
  statusCode?: number | null;
}

/**
 * Check idempotency before executing a mutation.
 *
 * @param exec      The executor (must be a Tx for the mutation)
 * @param tenantId  The tenant
 * @param userId    The acting user's id
 * @param route     The API route (e.g. "POST /shipments")
 * @param key       The client-supplied idempotency key
 * @param body      The parsed request body
 * @returns         IdempotencyResult — if replay, caller should
 *                  return the stored response instead of re-executing.
 */
export function checkIdempotency(
  exec: Executor,
  tenantId: string,
  userId: string,
  route: string,
  key: string,
  body: unknown,
): IdempotencyResult {
  const hash = hashPayload(userId, route, key, body);
  const now = Date.now();

  const existing = exec
    .select()
    .from(idempotencyKeys)
    .where(and(
      eq(idempotencyKeys.tenantId, tenantId),
      eq(idempotencyKeys.key, key),
    ))
    .get();

  if (existing) {
    // Check expiry.
    if (existing.expiresAt < now) {
      // Expired — treat as a fresh request. Delete the old record.
      exec.delete(idempotencyKeys).where(eq(idempotencyKeys.id, existing.id)).run();
      // Fall through to create a new record below.
    } else {
      // Key exists and is not expired — compare the hash.
      if (existing.requestHash !== hash) {
        throw new ApiError(
          "IDEMPOTENCY_KEY_REUSED",
          `Idempotency key "${key}" has already been used with a different request body.`,
        );
      }
      // Exact same request — return the stored response.
      return {
        replay: true,
        responseBody: existing.responseBody,
        statusCode: existing.statusCode,
      };
    }
  }

  // First request (or expired key) — insert a placeholder.
  exec
    .insert(idempotencyKeys)
    .values({
      id: newId(),
      tenantId,
      key,
      route,
      requestHash: hash,
      responseBody: null,
      statusCode: null,
      expiresAt: now + DEFAULT_TTL_MS,
      createdAt: now,
    })
    .run();

  return { replay: false };
}

/**
 * Store the response after executing a mutation.
 * Called after the mutation completes successfully.
 */
export function storeIdempotencyResponse(
  exec: Executor,
  tenantId: string,
  key: string,
  responseBody: string,
  statusCode: number,
): void {
  exec
    .update(idempotencyKeys)
    .set({ responseBody, statusCode })
    .where(and(
      eq(idempotencyKeys.tenantId, tenantId),
      eq(idempotencyKeys.key, key),
    ))
    .run();
}

/**
 * Clean up expired idempotency records.
 * Safe to call periodically (PRD §9.8).
 *
 * @returns The number of records deleted.
 */
export function cleanupExpiredIdempotency(exec: Executor): number {
  const now = Date.now();
  const result = exec
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.expiresAt, now))
    .run();
  return result.changes;
}
