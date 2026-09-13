import { hashPassword, createUser } from "@/lib/db-lazy";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zTeamInviteInput } from "@logiflow/contracts";
import type { Role } from "@logiflow/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/auth/team/invite — invite a teammate */
export async function POST(req: NextRequest) {
  return withAuth(
    { method: "POST", path: "/auth/team/invite", access: "auth", permission: "team:manage", audited: true, description: "Invite a teammate" },
    async ({ actor }) => {
      const parse = zTeamInviteInput.safeParse(await req.json());
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

      // Create with a temporary password (invite flow would normally send an email)
      const tempHash = hashPassword("TempPassword123!");
      const user = createUser(actor, {
        name: parse.data.name,
        email: parse.data.email,
        role: parse.data.role as Role,
        passwordHash: tempHash,
        invitedBy: actor.userId,
      });

      return NextResponse.json({
        data: {
          id: user.id,
          tenantId: user.tenantId,
          name: user.name,
          email: user.email,
          phone: user.phone ?? undefined,
          role: user.role,
          avatarUrl: user.avatarUrl ?? undefined,
          active: user.active,
          lastLoginAt: user.lastLoginAt ?? undefined,
          invitedBy: user.invitedBy ?? undefined,
          createdAt: user.createdAt,
        },
      }, { status: 201 });
    },
    req,
  );
}
