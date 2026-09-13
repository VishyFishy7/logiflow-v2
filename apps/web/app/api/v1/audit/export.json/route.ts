import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zAuditListQuery } from "@logiflow/contracts";
import { listAuditEvents } from "@/lib/db-lazy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/audit/export.json — JSON Lines export */
export async function GET(req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/audit/export.json", access: "auth", permission: "audit:export", audited: true, description: "JSON Lines export" },
    async ({ actor }) => {
      const url = new URL(req.url);
      const raw: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { raw[k] = v; });
      const parsed = zAuditListQuery.safeParse({ ...raw, page: 1, pageSize: 5000 });
      const query = parsed.success ? parsed.data : { page: 1, pageSize: 5000 } as any;
      const result = await listAuditEvents(actor, query);
      const jsonl = result.data.map((r: Record<string, unknown>) => JSON.stringify(r)).join("\n");
      return new NextResponse(jsonl, {
        status: 200,
        headers: {
          "Content-Type": "application/jsonl; charset=utf-8",
          "Content-Disposition": 'attachment; filename="audit.jsonl"',
        },
      });
    },
    req,
  );
}
