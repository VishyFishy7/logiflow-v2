import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zShipmentUpdateInput } from "@logiflow/contracts";
import { getShipmentDetail, updateShipment, softDeleteShipment } from "@/lib/db-lazy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/shipments/:id — shipment detail */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "GET", path: "/shipments/:id", access: "auth", permission: "shipment:read_assigned", scope: "assigned", description: "Shipment detail" },
    async ({ actor }) => {
      const detail = await getShipmentDetail(actor, id);
      return NextResponse.json({ data: detail });
    },
    _req,
    { id },
  );
}

/** PATCH /api/v1/shipments/:id — edit fields */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "PATCH", path: "/shipments/:id", access: "auth", permission: "shipment:update", scope: "assigned", audited: true, description: "Edit fields" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zShipmentUpdateInput.safeParse(body);
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
      const shipment = await updateShipment(actor, id, parsed.data as Record<string, unknown>);
      return NextResponse.json({ data: shipment });
    },
    req,
    { id },
  );
}

/** DELETE /api/v1/shipments/:id — soft delete */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "DELETE", path: "/shipments/:id", access: "auth", permission: "shipment:delete", audited: true, description: "Soft delete" },
    async ({ actor }) => {
      await softDeleteShipment(actor, id);
      return NextResponse.json({ ok: true });
    },
    _req,
    { id },
  );
}
