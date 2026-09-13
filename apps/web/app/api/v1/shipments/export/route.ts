import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zShipmentListQuery } from "@logiflow/contracts";
import { shipmentsCsv } from "@/lib/db-lazy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/shipments/export — CSV export, filter-aware */
export async function GET(req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/shipments/export", access: "auth", permission: "analytics:view", audited: true, description: "CSV export" },
    async ({ actor }) => {
      const url = new URL(req.url);
      const raw: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { raw[k] = v; });
      const parsed = zShipmentListQuery.safeParse({ ...raw, page: 1, pageSize: 200 });
      const query = parsed.success ? parsed.data : { page: 1, pageSize: 200 } as any;

      const csv = await shipmentsCsv(actor, query);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="shipments.csv"',
        },
      });
    },
    req,
  );
}
