import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/shipments/:id/sync — force a carrier sync */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "POST", path: "/shipments/:id/sync", access: "auth", permission: "shipment:update", scope: "assigned", audited: true, description: "Force carrier sync" },
    async () => {
      return NextResponse.json(
        { error: { code: "NOT_IMPLEMENTED", message: "Carrier sync not implemented yet" } },
        { status: 501 },
      );
    },
    _req,
    { id },
  );
}
