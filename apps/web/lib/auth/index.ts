import NextAuth from "next-auth";
import { authConfig } from "./config";

/**
 * Re-exports from Auth.js v5 — the canonical way to get handlers, auth(),
 * signIn, and signOut in App Router projects.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
