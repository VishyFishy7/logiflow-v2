import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zProfileUpdateInput } from "@logiflow/contracts";
import { getDb, users } from "@/lib/db-lazy";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/v1/auth/profile — update own profile and prefs */
export async function PATCH(req: NextRequest) {
  return withAuth(
    { method: "PATCH", path: "/auth/profile", access: "auth", audited: true, description: "Update own profile" },
    async ({ actor }) => {
      const parse = zProfileUpdateInput.safeParse(await req.json());
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

      const db = getDb();
      const now = Date.now();
      const patch: Record<string, unknown> = { updatedAt: now };
      if (parse.data.name !== undefined) patch.name = parse.data.name;
      if (parse.data.phone !== undefined) patch.phone = parse.data.phone;
      if (parse.data.avatarUrl !== undefined) patch.avatarUrl = parse.data.avatarUrl;
      if (parse.data.themePref !== undefined) patch.themePref = parse.data.themePref;
      if (parse.data.notificationPrefs !== undefined) patch.notificationPrefs = parse.data.notificationPrefs;

      const updated = db.update(users).set(patch).where(eq(users.id, actor.userId)).returning().get();

      return NextResponse.json({
        data: {
          id: updated.id,
          tenantId: updated.tenantId,
          name: updated.name,
          email: updated.email,
          phone: updated.phone ?? undefined,
          role: updated.role,
          avatarUrl: updated.avatarUrl ?? undefined,
          active: updated.active,
          lastLoginAt: updated.lastLoginAt ?? undefined,
          invitedBy: updated.invitedBy ?? undefined,
          createdAt: updated.createdAt,
        },
      });
    },
    req,
  );
}
