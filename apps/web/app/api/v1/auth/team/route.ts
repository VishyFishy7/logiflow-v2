import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { listTeam } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/auth/team — team list */
export async function GET(req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/auth/team", access: "auth", permission: "team:manage", description: "Team list" },
    async ({ actor }) => {
      const url = new URL(req.url);
      const query = {
        q: url.searchParams.get("q") ?? undefined,
        sort: url.searchParams.get("sort") ?? undefined,
        dir: (url.searchParams.get("dir") as "asc" | "desc") ?? undefined,
        page: Number(url.searchParams.get("page") ?? "1"),
        pageSize: Number(url.searchParams.get("pageSize") ?? "25"),
      };
      const result = listTeam(actor, query);
      return NextResponse.json(result);
    },
    req,
  );
}
