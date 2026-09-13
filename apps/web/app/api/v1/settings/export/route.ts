import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { exportSnapshot } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/settings/export — portable JSON snapshot */
export async function GET(_req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/settings/export", access: "auth", permission: "settings:manage", audited: true, description: "Portable JSON snapshot" },
    async ({ actor, requestId }) => {
      const dir = exportSnapshot(actor.tenantId, requestId, actor.userId);
      return NextResponse.json({ data: { path: dir } });
    },
    _req,
  );
}
