import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { markAllRead } from "@/lib/db-lazy";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/notifications/read-all — mark all read */
export async function POST(_req: NextRequest) {
  return withAuth(
    { method: "POST", path: "/notifications/read-all", access: "auth", description: "Mark all read" },
    async ({ actor }) => {
      const db = getDb();
      const updated = markAllRead(db, actor.tenantId, actor.userId);
      return NextResponse.json({ updated });
    },
    _req,
  );
}
