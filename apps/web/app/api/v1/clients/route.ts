import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zClientCreateInput } from "@logiflow/contracts";
import { listClients, createClient } from "@/lib/db-lazy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/clients — list clients */
export async function GET(req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/clients", access: "auth", permission: "client:read", description: "List clients" },
    async ({ actor }) => {
      const url = new URL(req.url);
      const query = {
        q: url.searchParams.get("q") ?? undefined,
        page: Number(url.searchParams.get("page") ?? "1"),
        pageSize: Number(url.searchParams.get("pageSize") ?? "25"),
      };
      const result = listClients(actor, query);
      return NextResponse.json(result);
    },
    req,
  );
}

/** POST /api/v1/clients — create a client */
export async function POST(req: NextRequest) {
  return withAuth(
    { method: "POST", path: "/clients", access: "auth", permission: "client:manage", audited: true, description: "Create a client" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zClientCreateInput.safeParse(body);
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
      const client = createClient(actor, parsed.data);
      return NextResponse.json({ data: client }, { status: 201 });
    },
    req,
  );
}
