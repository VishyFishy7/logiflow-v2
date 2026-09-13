import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zLeadActivityInput } from "@logiflow/contracts";
import { addLeadActivity } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/leads/:id/activity — append an activity */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "POST", path: "/leads/:id/activity", access: "auth", permission: "lead:manage", scope: "assigned", audited: true, description: "Append an activity" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zLeadActivityInput.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: "VALIDATION_FAILED", message: "Invalid input" } },
          { status: 400 },
        );
      }
      const lead = await addLeadActivity(actor, id, parsed.data);
      return NextResponse.json({ data: lead });
    },
    req,
    { id },
  );
}
