import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { convertLead } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/leads/:id/convert — convert to a client */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "POST", path: "/leads/:id/convert", access: "auth", permission: "client:manage", scope: "assigned", audited: true, description: "Convert to a client" },
    async ({ actor }) => {
      const body = await req.json().catch(() => ({}));
      const client = await convertLead(actor, id, body);
      return NextResponse.json({ data: client });
    },
    req,
    { id },
  );
}
