import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/shipments/:id/carrier-booking — book with carrier adapter */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "POST", path: "/shipments/:id/carrier-booking", access: "auth", permission: "shipment:update", scope: "assigned", audited: true, description: "Book with carrier" },
    async () => {
      return NextResponse.json(
        { error: { code: "NOT_IMPLEMENTED", message: "Carrier booking not implemented yet" } },
        { status: 501 },
      );
    },
    _req,
    { id },
  );
}
