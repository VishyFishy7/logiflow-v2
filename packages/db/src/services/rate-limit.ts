/**
 * In-process rate limiter for the login and public-tracking endpoints.
 * PRD §9.8 — login: 5 requests/min/IP with exponential backoff;
 *             public tracking: 10 requests/min/IP.
 *
 * This is a sliding-window counter keyed by IP + route. Not distributed —
 * adequate for a single-process SQLite-backed dev server. Production would
 * swap this for a Redis-backed driver (the RATE_LIMIT_DRIVER env var in §17.1
 * is reserved for that).
 *
 * The `reset()` function is exported for tests so the limiter state does not
 * leak across test cases.
 */
import { ApiError } from "../errors";

interface Bucket {
  count: number;
  windowStart: number;
  failures: number;
}

/**
 * Sliding-window rate limiter.
 *
 * @param maxRequests  Maximum requests allowed within the window.
 * @param windowMs     Window duration in milliseconds.
 * @param backoffBase  Base seconds for the exponential backoff after the first
 *                     violation. The retry-after is
 *                     `backoffBase * 2^(failures-1)`, capped at `backoffMax`.
 * @param backoffMax   Maximum retry-after seconds.
 */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly backoffBase: number;
  private readonly backoffMax: number;

  constructor(options: {
    maxRequests: number;
    windowMs: number;
    backoffBase?: number;
    backoffMax?: number;
  }) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    this.backoffBase = options.backoffBase ?? 30;
    this.backoffMax = options.backoffMax ?? 300;
  }

  /**
   * Check and consume a rate-limit token.
   *
   * @returns The remaining seconds until the window resets (0 if within budget).
   * @throws  `ApiError('RATE_LIMITED')` when the budget is exhausted.
   */
  check(key: string): number {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    // Window expired or first request — start a new window.
    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now, failures: 0 });
      return 0;
    }

    // Within the current window.
    bucket.count += 1;

    if (bucket.count <= this.maxRequests) {
      return 0;
    }

    // Over budget — increment failure count and compute retry-after.
    bucket.failures += 1;
    const retryAfter = Math.min(
      this.backoffBase * Math.pow(2, bucket.failures - 1),
      this.backoffMax,
    );

    throw new ApiError("RATE_LIMITED", "Too many requests. Please try again later.", {
      detail: { retryAfter },
    });
  }

  /**
   * Get the number of requests remaining in the current window.
   * Returns `maxRequests` when no bucket exists.
   */
  remaining(key: string): number {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - bucket.count);
  }

  /**
   * Reset all state. Use in tests to avoid leaking across cases.
   */
  reset(): void {
    this.buckets.clear();
  }

  /**
   * Prune expired buckets to bound memory. Call periodically if the limiter
   * lives for a long time (e.g. in a long-running server).
   */
  prune(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStart >= this.windowMs * 2) {
        this.buckets.delete(key);
      }
    }
  }
}

// ── Pre-configured instances ────────────────────────────────────────────────

/** Login rate limiter: 5 requests per minute per IP. */
export const loginLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60_000,
  backoffBase: 30,
  backoffMax: 300,
});

/**
 * Public tracking rate limiter: 10 requests per minute per IP.
 * PRD §9.8 / §8.3 rule 6.
 */
export const trackingLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
  backoffBase: 15,
  backoffMax: 120,
});

/**
 * Build the rate-limit bucket key from an IP and a route path.
 * e.g. `key("127.0.0.1", "/api/v1/auth/login")` → `"127.0.0.1:POST:/api/v1/auth/login"`.
 */
export function rateLimitKey(ip: string | null | undefined, route: string, method: string = "POST"): string {
  const safeIp = ip ?? "unknown";
  return `${safeIp}:${method}:${route}`;
}
