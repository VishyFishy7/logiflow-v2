import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { listNotifications } from "@/lib/db-lazy";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/notifications — list notifications */
export async function GET(req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/notifications", access: "auth", description: "List notifications" },
    async ({ actor }) => {
      const db = getDb();
      const rows = listNotifications(db, actor.tenantId, actor.userId);
      return NextResponse.json({ data: rows, page: 1, pageSize: rows.length, total: rows.length, totalPages: 1 });
    },
    req,
  );
}
