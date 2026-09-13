import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { markRead } from "@/lib/db-lazy";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/notifications/:id/read — mark one read */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "POST", path: "/notifications/:id/read", access: "auth", description: "Mark one read" },
    async ({ actor }) => {
      const db = getDb();
      markRead(db, actor.tenantId, id);
      return NextResponse.json({ ok: true });
    },
    _req,
    { id },
  );
}
