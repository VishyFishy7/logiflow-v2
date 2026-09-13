/**
 * Job queue — PRD §9.5.
 *
 * A lightweight SQLite-based job queue with:
 *   - naturalKey dedup (unique index prevents duplicate enqueues)
 *   - claim/lease semantics (lockedAt prevents double-processing)
 *   - exponential backoff with jitter
 *   - max attempt count + dead-lettering (failed → done after max)
 *   - lastError capture for diagnostics
 *
 * Job types are from the contracts JOB_TYPES enum.
 */
import { eq, and, lt, isNull, asc, sql } from "drizzle-orm";
import { newId } from "@logiflow/shared";
import type { JobType } from "@logiflow/contracts";
import { jobs } from "../schema/index";
import type { Executor } from "../client";

// ── Constants ───────────────────────────────────────────────────────────────

/** Maximum number of attempts before dead-lettering. */
const MAX_ATTEMPTS = 5;

/** Base delay for exponential backoff (ms). */
const BASE_BACKOFF_MS = 1000;

/** Maximum backoff delay (ms). */
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes

/** Lease duration — how long a job stays locked (ms). */
const LEASE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ── Types ───────────────────────────────────────────────────────────────────

export interface EnqueueOptions {
  /** When to run. Defaults to now. */
  runAt?: number;
  /** Natural key for dedup. If omitted, a unique key is generated (no dedup). */
  naturalKey?: string;
}

export interface JobRow {
  id: string;
  tenantId: string;
  type: string;
  payload: unknown;
  naturalKey: string;
  runAt: number;
  attempts: number;
  lastError: string | null;
  status: string;
  lockedAt: number | null;
  finishedAt: number | null;
  createdAt: number;
}

// ── Enqueue ─────────────────────────────────────────────────────────────────

/**
 * Enqueue a job. If a job with the same naturalKey already exists and is
 * not dead-lettered, the enqueue is a no-op (dedup).
 *
 * @returns The job id, or null if a duplicate was skipped.
 */
export function enqueue(
  exec: Executor,
  tenantId: string,
  type: JobType,
  payload: unknown,
  opts: EnqueueOptions = {},
): string | null {
  const now = Date.now();
  const naturalKey = opts.naturalKey ?? `${type}:${newId()}`;
  const runAt = opts.runAt ?? now;

  // Dedup: check if a non-dead-lettered job with this key exists.
  const existing = exec
    .select({ id: jobs.id, status: jobs.status })
    .from(jobs)
    .where(eq(jobs.naturalKey, naturalKey))
    .get();

  if (existing && existing.status !== "failed") {
    // Already queued or running — skip.
    return null;
  }

  const id = newId();
  exec
    .insert(jobs)
    .values({
      id,
      tenantId,
      type,
      payload,
      naturalKey,
      runAt,
      attempts: 0,
      lastError: null,
      status: "queued",
      lockedAt: null,
      finishedAt: null,
      createdAt: now,
    })
    .run();

  return id;
}

// ── Claim / Release / Fail ──────────────────────────────────────────────────

/**
 * Claim the next runnable job for processing.
 *
 * Returns null if no jobs are available. The job is locked with a
 * lease duration so a crashed worker doesn't leave jobs permanently
 * locked (they'll be re-claimed after the lease expires).
 */
export function claimJob(exec: Executor, tenantId: string): JobRow | null {
  const now = Date.now();

  // Find the next queued job that is due, or any locked job whose lease expired.
  const candidate = exec
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.tenantId, tenantId),
        sql`(
          (${jobs.status} = 'queued' AND ${jobs.runAt} <= ${now})
          OR
          (${jobs.status} = 'running' AND ${jobs.lockedAt} IS NOT NULL AND ${jobs.lockedAt} < ${now - LEASE_DURATION_MS})
        )`,
      ),
    )
    .orderBy(asc(jobs.runAt))
    .limit(1)
    .get();

  if (!candidate) return null;

  // Lock it.
  exec
    .update(jobs)
    .set({
      status: "running",
      lockedAt: now,
      attempts: candidate.attempts + 1,
    })
    .where(eq(jobs.id, candidate.id))
    .run();

  return {
    ...candidate,
    status: "running",
    lockedAt: now,
    attempts: candidate.attempts + 1,
  } as JobRow;
}

/**
 * Mark a job as done (successful completion).
 */
export function completeJob(exec: Executor, jobId: string): void {
  exec
    .update(jobs)
    .set({
      status: "done",
      lockedAt: null,
      finishedAt: Date.now(),
    })
    .where(eq(jobs.id, jobId))
    .run();
}

/**
 * Mark a job as failed with exponential backoff, or dead-letter if
 * max attempts exceeded.
 *
 * @returns The next runAt timestamp, or null if dead-lettered.
 */
export function failJob(
  exec: Executor,
  jobId: string,
  errorMessage: string,
): number | null {
  const now = Date.now();

  const job = exec
    .select({ attempts: jobs.attempts })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .get();

  if (!job) return null;

  if (job.attempts >= MAX_ATTEMPTS) {
    // Dead-letter: mark as failed permanently.
    exec
      .update(jobs)
      .set({
        status: "failed",
        lockedAt: null,
        finishedAt: now,
        lastError: errorMessage,
      })
      .where(eq(jobs.id, jobId))
      .run();
    return null;
  }

  // Exponential backoff with jitter: base * 2^attempts + random jitter.
  const backoff = Math.min(
    BASE_BACKOFF_MS * Math.pow(2, job.attempts),
    MAX_BACKOFF_MS,
  );
  const jitter = Math.floor(Math.random() * backoff * 0.3);
  const nextRunAt = now + backoff + jitter;

  exec
    .update(jobs)
    .set({
      status: "queued",
      lockedAt: null,
      runAt: nextRunAt,
      lastError: errorMessage,
    })
    .where(eq(jobs.id, jobId))
    .run();

  return nextRunAt;
}

// ── Query helpers ───────────────────────────────────────────────────────────

export function getJob(exec: Executor, jobId: string): JobRow | undefined {
  return exec.select().from(jobs).where(eq(jobs.id, jobId)).get() as JobRow | undefined;
}

export function countJobsByStatus(exec: Executor, tenantId: string): Record<string, number> {
  const rows = exec
    .select({ status: jobs.status, count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.tenantId, tenantId))
    .groupBy(jobs.status)
    .all();

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.status] = row.count;
  }
  return result;
}
