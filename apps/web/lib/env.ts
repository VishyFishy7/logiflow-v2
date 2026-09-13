/**
 * Deployment-mode switch (PRD §17.2).
 *
 *   NEXT_PUBLIC_API_MODE=mock  → the browser talks to MSW handlers built from
 *                                the same route table, no server needed.
 *   NEXT_PUBLIC_API_MODE=live  → the browser talks to the real /api/v1 handlers
 *                                backed by SQLite (or Postgres in production).
 *
 * The UI is byte-identical in both modes: it only ever knows `lib/api/client.ts`.
 * Defaults to `mock` so a fresh clone runs with zero configuration, which is
 * what §17.4 promises.
 */
export const API_MODE: "mock" | "live" =
  process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";

/** Tenant-facing product name used before the session loads (PRD §6.3). */
export const FALLBACK_PRODUCT_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "LogiFlow";

/** Set to "false" to hide the demo-account hint on the login screen. */
export const SHOW_DEMO_HINTS = process.env.NEXT_PUBLIC_DEMO !== "false";

/** True when the app is running the live API against a real database. */
export const IS_LIVE = API_MODE === "live";
