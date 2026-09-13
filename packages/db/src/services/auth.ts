/**
 * Password + credential handling using node:crypto only (NO external auth
 * library). PRD §9.8 specifies:
 *   - Argon2id is the PRD's stated preference, but §4.3 says the stack uses
 *     Auth.js. Since we are NOT using Auth.js (the task explicitly says
 *     "node:crypto only, NO external auth library"), we use scrypt with a
 *     self-describing hash string so parameters can be upgraded later.
 *   - Constant-time comparison to prevent timing attacks.
 *   - Login reveals nothing about which field failed (PRD §9.8).
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../client.js";
import { users, tenants } from "../schema/index.js";
import { ApiError } from "../errors.js";
import { createSession, type SessionResult } from "./session.js";

// ── Self-describing hash format ─────────────────────────────────────────────
//
// Format: `scrypt$N=$r=$p=$salt$hash`
//   - N, r, p are scrypt parameters (the cost factors)
//   - salt is a hex-encoded random salt
//   - hash is the hex-encoded derived key
//
// This format is self-describing so we can upgrade parameters later:
//   1. Parse the stored hash to extract N, r, p.
//   2. Hash the candidate password with those parameters.
//   3. Compare the hashes.
//   4. If the stored parameters are weaker than the current defaults,
//      re-hash the password on successful login and store the new hash.
//
// Example: `scrypt$N=16384$r=8$p=1$a3f2b1c...$d4e5f6...`

const CURRENT_N = 16384;
const CURRENT_R = 8;
const CURRENT_P = 1;
const SALT_BYTES = 32;
const KEY_LENGTH = 64;

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
  raw: string;
}

function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split("$");
  // Expected: ["scrypt", "N=16384", "r=8", "p=1", "saltHex", "hashHex"]
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const N = parseInt(parts[1]!.split("=")[1] ?? "0", 10);
  const r = parseInt(parts[2]!.split("=")[1] ?? "0", 10);
  const p = parseInt(parts[3]!.split("=")[1] ?? "0", 10);

  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return null;
  if (N <= 0 || r <= 0 || p <= 0) return null;

  const salt = Buffer.from(parts[4] ?? "", "hex");
  const hash = Buffer.from(parts[5] ?? "", "hex");

  if (salt.length === 0 || hash.length === 0) return null;

  return { N, r, p, salt, hash, raw: stored };
}

function formatHash(N: number, r: number, p: number, salt: Buffer, hash: Buffer): string {
  return `scrypt$N=${N}$r=${r}$p=${p}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * Hash a password using scrypt with the current default parameters.
 * Returns the self-describing hash string.
 *
 * Uses `scryptSync` (not the async promisified version) because the
 * underlying better-sqlite3 driver is synchronous and password hashing
 * happens during login/signup — not in a hot path.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const key = scryptSync(password, salt, KEY_LENGTH, {
    N: CURRENT_N,
    r: CURRENT_R,
    p: CURRENT_P,
  });
  return formatHash(CURRENT_N, CURRENT_R, CURRENT_P, salt, key);
}

/**
 * Verify a password against a stored hash.
 *
 * Returns `{ valid: true, rehashed?: string }` when the password matches.
 * When the stored parameters are weaker than the current defaults and the
 * password is correct, `rehashed` contains the new hash string — the caller
 * should persist it.
 *
 * Returns `{ valid: false }` on mismatch.
 */
export function verifyPassword(
  password: string,
  stored: string,
): { valid: boolean; rehashed?: string } {
  const parsed = parseHash(stored);
  if (!parsed) return { valid: false };

  const candidate = scryptSync(password, parsed.salt, KEY_LENGTH, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
  });

  // Constant-time comparison to prevent timing side-channels.
  const valid = candidate.length === parsed.hash.length && timingSafeEqual(candidate, parsed.hash);

  if (!valid) return { valid: false };

  // If the stored params are weaker than current defaults, re-hash.
  const needsUpgrade = parsed.N < CURRENT_N || parsed.r < CURRENT_R || parsed.p < CURRENT_P;
  if (needsUpgrade) {
    const rehashed = hashPassword(password);
    return { valid: true, rehashed };
  }

  return { valid: true };
}

/**
 * Basic password strength checks. Returns an array of violation strings;
 * an empty array means the password passes.
 *
 * Rules (PRD §9.8 — practical minimum):
 *   - At least 8 characters
 *   - At least one uppercase letter
 *   - At least one lowercase letter
 *   - At least one digit
 */
export function checkPasswordStrength(password: string): string[] {
  const violations: string[] = [];
  if (password.length < 8) violations.push("Password must be at least 8 characters");
  if (!/[A-Z]/.test(password)) violations.push("Password must contain at least one uppercase letter");
  if (!/[a-z]/.test(password)) violations.push("Password must contain at least one lowercase letter");
  if (!/[0-9]/.test(password)) violations.push("Password must contain at least one digit");
  return violations;
}

// ── Login ───────────────────────────────────────────────────────────────────

/**
 * Authenticate a user by tenant slug + email + password.
 *
 * PRD §9.8: On a bad password the error is always `INVALID_CREDENTIALS`,
 * regardless of whether the email was valid. This prevents email enumeration.
 * An inactive account returns `ACCOUNT_INACTIVE` — but only when the
 * credentials would otherwise be valid (to avoid leaking active status).
 *
 * On success, creates a session and returns it.
 */
export async function login(
  tenantSlug: string,
  email: string,
  password: string,
  options?: {
    ip?: string | null;
    userAgent?: string | null;
    requestId: string;
  },
): Promise<SessionResult> {
  // 1. Resolve the tenant by slug.
  const tenant = db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).get();
  if (!tenant) {
    // Tenant not found — still throw INVALID_CREDENTIALS to prevent enumeration.
    throw new ApiError("INVALID_CREDENTIALS", "Invalid email or password");
  }

  // 2. Find the user by email within this tenant.
  const user = db
    .select()
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.email, email.toLowerCase().trim())))
    .get();

  if (!user) {
    // User not found — same error as wrong password (PRD §9.8).
    throw new ApiError("INVALID_CREDENTIALS", "Invalid email or password");
  }

  // 3. Check account lockout.
  const now = Date.now();
  if (user.lockedUntil && user.lockedUntil > now) {
    throw new ApiError("INVALID_CREDENTIALS", "Invalid email or password");
  }

  // 4. Verify the password.
  const result = verifyPassword(password, user.passwordHash);
  if (!result.valid) {
    // Increment failed logins; lock after 10 consecutive failures.
    const newCount = user.failedLogins + 1;
    const lockUntil = newCount >= 10 ? now + 15 * 60_000 : null; // 15-min lockout
    db.update(users)
      .set({
        failedLogins: newCount,
        lockedUntil: lockUntil,
        updatedAt: now,
      })
      .where(eq(users.id, user.id))
      .run();
    throw new ApiError("INVALID_CREDENTIALS", "Invalid email or password");
  }

  // 5. Check if account is active.
  if (!user.active) {
    throw new ApiError("ACCOUNT_INACTIVE", "This account has been deactivated");
  }

  // 6. If password hash needs upgrading, persist the new hash.
  if (result.rehashed) {
    db.update(users)
      .set({ passwordHash: result.rehashed, updatedAt: now })
      .where(eq(users.id, user.id))
      .run();
  }

  // 7. Update last login and reset failed attempts.
  db.update(users)
    .set({
      lastLoginAt: now,
      failedLogins: 0,
      lockedUntil: null,
      updatedAt: now,
    })
    .where(eq(users.id, user.id))
    .run();

  // 8. Create a session.
  const session = createSession(user, {
    ip: options?.ip ?? null,
    userAgent: options?.userAgent ?? null,
    requestId: options?.requestId,
  });

  return session;
}
