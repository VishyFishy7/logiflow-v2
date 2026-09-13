/**
 * Server-only DB singleton.
 * Uses the lazy proxy to avoid Turbopack bundling the native better-sqlite3.
 */
import "server-only";

// Re-export everything from the lazy proxy
export { getDb } from "@/lib/db-lazy";
