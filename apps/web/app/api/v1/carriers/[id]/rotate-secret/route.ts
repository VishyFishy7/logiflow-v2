import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/carriers/:id/rotate-secret — rotate webhook secret */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "POST", path: "/carriers/:id/rotate-secret", access: "auth", permission: "carrier:manage", audited: true, description: "Rotate webhook secret" },
    async () => {
      return NextResponse.json(
        { error: { code: "NOT_IMPLEMENTED", message: "Webhook secret rotation not implemented" } },
        { status: 501 },
      );
    },
    _req,
    { id },
  );
}
