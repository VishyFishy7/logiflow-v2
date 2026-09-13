import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zChangePasswordInput } from "@logiflow/contracts";
import { verifyPassword, hashPassword, getDb, users } from "@/lib/db-lazy";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/auth/password — change own password */
export async function POST(req: NextRequest) {
  return withAuth(
    { method: "POST", path: "/auth/password", access: "auth", audited: true, description: "Change own password" },
    async ({ actor }) => {
      const parse = zChangePasswordInput.safeParse(await req.json());
      if (!parse.success) {
        return NextResponse.json(
          { error: { code: "VALIDATION_FAILED", message: "Invalid input" } },
          { status: 400 },
        );
      }

      const db = getDb();
      const user = db.select().from(users).where(eq(users.id, actor.userId)).get();
      if (!user) {
        return NextResponse.json(
          { error: { code: "USER_NOT_FOUND", message: "User not found" } },
          { status: 404 },
        );
      }

      const result = verifyPassword(parse.data.currentPassword, user.passwordHash);
      if (!result.valid) {
        return NextResponse.json(
          { error: { code: "INVALID_CREDENTIALS", message: "Current password is incorrect" } },
          { status: 401 },
        );
      }

      const newHash = hashPassword(parse.data.newPassword);
      db.update(users).set({ passwordHash: newHash, updatedAt: Date.now() }).where(eq(users.id, actor.userId)).run();

      return NextResponse.json({ ok: true });
    },
    req,
  );
}
