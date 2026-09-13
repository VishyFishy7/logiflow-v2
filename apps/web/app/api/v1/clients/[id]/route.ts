import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zClientUpdateInput } from "@logiflow/contracts";
import { updateClient } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/v1/clients/:id — update a client */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "PATCH", path: "/clients/:id", access: "auth", permission: "client:manage", audited: true, description: "Update a client" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zClientUpdateInput.safeParse(body);
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
      const client = updateClient(actor, id, parsed.data);
      return NextResponse.json({ data: client });
    },
    req,
    { id },
  );
}
