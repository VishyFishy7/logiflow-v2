import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zShipmentBulkStatusInput } from "@logiflow/contracts";
import { bulkStatus } from "@/lib/db-lazy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/shipments/bulk/status — bulk status log */
export async function POST(req: NextRequest) {
  return withAuth(
    { method: "POST", path: "/shipments/bulk/status", access: "auth", permission: "shipment:log_status", scope: "assigned", audited: true, description: "Bulk status log" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zShipmentBulkStatusInput.safeParse(body);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          fieldErrors[issue.path.join(".")] = issue.message;
        }
        return NextResponse.json(
          { error: { code: "VALIDATION_FAILED", message: "Invalid input", fieldErrors } },
          { status: 400 },
        );
      }
      const updated = await bulkStatus(actor, parsed.data as any);
      return NextResponse.json({ updated });
    },
    req,
  );
}
