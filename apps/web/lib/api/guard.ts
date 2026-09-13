import { NextResponse, type NextRequest } from "next/server";
import { getActor } from "@/lib/session";
import { grantFor, type Permission, type Role } from "@logiflow/shared";
import type { RouteSpec } from "@logiflow/contracts/routes";

/** Contract error envelope. */
function errorResponse(
  code: string,
  message: string,
  status: number,
  fieldErrors?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(fieldErrors ? { fieldErrors } : {}),
        requestId: crypto.randomUUID(),
      },
    },
    { status },
  );
}

/**
 * Auth + permission guard for route handlers.
 */
export async function withAuth<Params extends Record<string, string> = Record<string, string>>(
  spec: RouteSpec,
  handler: (ctx: {
    actor: any;
    params: Params;
    req: NextRequest;
    requestId: string;
  }) => Promise<NextResponse>,
  req: NextRequest,
  params?: Params,
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  // Public routes — no auth required
  if (spec.access === "public") {
    const actor = {
      userId: "anonymous",
      tenantId: "",
      name: "Anonymous",
      email: "",
      role: "viewer" as Role,
      permissions: [],
      requestId,
      source: "web" as const,
      reveal: false,
    };
    return handler({ actor, params: (params ?? {}) as Params, req, requestId });
  }

  // Auth required
  const actor = await getActor();
  if (!actor) {
    return errorResponse("UNAUTHENTICATED", "Authentication required", 401);
  }

  // Permission check
  if (spec.permission) {
    const grant = grantFor(actor.role, spec.permission as Permission);
    if (grant === "deny") {
      return errorResponse("FORBIDDEN", "You do not have permission to perform this action", 403);
    }
  }

  actor.requestId = requestId;

  const response = await handler({ actor, params: (params ?? {}) as Params, req, requestId });

  // Record audit for audited routes (only on success, only for non-GET)
  if (spec.audited && req.method !== "GET" && response.status >= 200 && response.status < 300) {
    try {
      // Lazy-load to avoid bundling native deps
      const { recordAudit, getDb } = await import("@/lib/db-lazy");
      const db = getDb();
      recordAudit(db, actor, {
        action: `${req.method.toLowerCase()}.${spec.path.split("/").filter(Boolean).pop()}`,
        entityType: spec.path.split("/").filter(Boolean)[0] ?? "system",
        entityId: params?.id ?? "n/a",
        entityLabel: spec.description,
        summary: spec.description,
      });
    } catch {
      // Audit failure should not block the response
    }
  }

  return response;
}
