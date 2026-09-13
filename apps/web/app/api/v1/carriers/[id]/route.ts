import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zCarrierUpdateInput } from "@logiflow/contracts";
import { updateCarrier } from "@/lib/db-lazy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/v1/carriers/:id — update a carrier */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "PATCH", path: "/carriers/:id", access: "auth", permission: "carrier:manage", audited: true, description: "Update a carrier" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zCarrierUpdateInput.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: "VALIDATION_FAILED", message: "Invalid input" } },
          { status: 400 },
        );
      }
      const carrier = updateCarrier(actor, id, parsed.data);
      return NextResponse.json({ data: carrier });
    },
    req,
    { id },
  );
}
