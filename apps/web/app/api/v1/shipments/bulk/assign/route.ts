import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zShipmentBulkAssignInput } from "@logiflow/contracts";
import { bulkAssign } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/shipments/bulk/assign — bulk assign */
export async function POST(req: NextRequest) {
  return withAuth(
    { method: "POST", path: "/shipments/bulk/assign", access: "auth", permission: "shipment:assign", audited: true, description: "Bulk assign" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zShipmentBulkAssignInput.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: "VALIDATION_FAILED", message: "Invalid input" } },
          { status: 400 },
        );
      }
      const updated = await bulkAssign(actor, parsed.data);
      return NextResponse.json({ updated });
    },
    req,
  );
}
