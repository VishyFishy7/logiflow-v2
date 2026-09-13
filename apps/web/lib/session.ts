import { cookies } from "next/headers";
import { IS_LIVE } from "@/lib/env";
import { demoSession } from "@logiflow/contracts/fixtures";
import { auth } from "@/lib/auth";
import type { SessionResponse } from "@logiflow/contracts";
import { permissionsFor, grantFor, type Role } from "@logiflow/shared";

/**
 * Build a SessionResponse for the current request.
 * - **mock mode**: reads the `lf_mock_role` cookie and returns the fixture.
 * - **live mode**: reads the Auth.js session, loads user + tenant from DB.
 */
export async function getSession(): Promise<SessionResponse | null> {
  if (!IS_LIVE) {
    const store = await cookies();
    const roleCookie = store.get("lf_mock_role");
    const role = (roleCookie?.value ?? "owner") as Role;
    return demoSession(role);
  }

  const session = await auth();
  if (!session?.user) return null;

  const userId = (session.user as Record<string, unknown>).id as string;
  const tenantId = (session.user as Record<string, unknown>).tenantId as string;
  const role = (session.user as Record<string, unknown>).role as Role;

  // Lazy-load the DB to avoid Turbopack bundling native deps
  const { buildSessionResponse } = await import("@/lib/db-lazy");

  const actor = {
    userId,
    tenantId,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role,
    permissions: permissionsFor(role),
    requestId: "session",
    source: "web" as const,
    reveal: grantFor(role, "tracking:reveal") !== "deny",
  };

  return buildSessionResponse(actor);
}

/**
 * Get the Actor for the current request.
 */
export async function getActor() {
  if (!IS_LIVE) {
    const store = await cookies();
    const roleCookie = store.get("lf_mock_role");
    const role = (roleCookie?.value ?? "owner") as Role;
    const session = demoSession(role);
    return {
      userId: session.user.id,
      tenantId: session.user.tenantId,
      name: session.user.name,
      email: session.user.email,
      role: session.role,
      permissions: session.permissions,
      requestId: crypto.randomUUID(),
      source: "web" as const,
      reveal: grantFor(role, "tracking:reveal") !== "deny",
    };
  }

  const session = await auth();
  if (!session?.user) return null;

  const userId = (session.user as Record<string, unknown>).id as string;
  const tenantId = (session.user as Record<string, unknown>).tenantId as string;
  const role = (session.user as Record<string, unknown>).role as Role;

  return {
    userId,
    tenantId,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role,
    permissions: permissionsFor(role),
    requestId: crypto.randomUUID(),
    source: "web" as const,
    reveal: grantFor(role, "tracking:reveal") !== "deny",
  };
}
