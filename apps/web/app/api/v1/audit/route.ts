import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zAuditListQuery } from "@logiflow/contracts";
import { listAuditEvents } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/audit — paged audit log */
export async function GET(req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/audit", access: "auth", permission: "audit:read", description: "Paged audit log" },
    async ({ actor }) => {
      const url = new URL(req.url);
      const raw: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { raw[k] = v; });
      const parsed = zAuditListQuery.safeParse(raw);
      const query = parsed.success ? parsed.data : { page: 1, pageSize: 50 } as any;
      const result = await listAuditEvents(actor, query);
      return NextResponse.json(result);
    },
    req,
  );
}
