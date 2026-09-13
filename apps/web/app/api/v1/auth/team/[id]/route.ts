import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zTeamUpdateInput } from "@logiflow/contracts";
import { changeRole, deactivateUser } from "@/lib/db-lazy";
import type { Role } from "@logiflow/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/v1/auth/team/:id — change role or deactivate */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "PATCH", path: "/auth/team/:id", access: "auth", permission: "team:manage", audited: true, description: "Change role or deactivate" },
    async ({ actor }) => {
      const parse = zTeamUpdateInput.safeParse(await req.json());
      if (!parse.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parse.error.issues) {
          fieldErrors[issue.path.join(".")] = issue.message;
        }
        return NextResponse.json(
          { error: { code: "VALIDATION_FAILED", message: "Invalid input", fieldErrors } },
          { status: 400 },
        );
      }

      if (parse.data.active === false) {
        deactivateUser(actor, id);
      }
      if (parse.data.role) {
        changeRole(actor, id, parse.data.role as Role);
      }

      return NextResponse.json({ ok: true });
    },
    req,
    { id },
  );
}
