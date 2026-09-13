import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zLeadListQuery, zLeadCreateInput } from "@logiflow/contracts";
import { listLeads, createLead } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/leads — list leads (scoped) */
export async function GET(req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/leads", access: "auth", permission: "lead:read_assigned", scope: "assigned", description: "List leads" },
    async ({ actor }) => {
      const url = new URL(req.url);
      const raw: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { raw[k] = v; });
      const parsed = zLeadListQuery.safeParse(raw);
      const query = parsed.success ? parsed.data : { page: 1, pageSize: 25 } as any;
      const result = await listLeads(actor, query);
      return NextResponse.json(result);
    },
    req,
  );
}

/** POST /api/v1/leads — create a lead */
export async function POST(req: NextRequest) {
  return withAuth(
    { method: "POST", path: "/leads", access: "auth", permission: "lead:manage", audited: true, description: "Create a lead" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zLeadCreateInput.safeParse(body);
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
      const lead = await createLead(actor, parsed.data as any);
      return NextResponse.json({ data: lead }, { status: 201 });
    },
    req,
  );
}
