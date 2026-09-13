import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zLeadUpdateInput } from "@logiflow/contracts";
import { updateLead } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/v1/leads/:id — update a lead */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "PATCH", path: "/leads/:id", access: "auth", permission: "lead:manage", scope: "assigned", audited: true, description: "Update a lead" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zLeadUpdateInput.safeParse(body);
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
      const lead = await updateLead(actor, id, parsed.data);
      return NextResponse.json({ data: lead });
    },
    req,
    { id },
  );
}
