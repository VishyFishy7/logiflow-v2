import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zCarrierCreateInput } from "@logiflow/contracts";
import { listCarriers, createCarrier } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/carriers — list carriers */
export async function GET(req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/carriers", access: "auth", permission: "client:read", description: "List carriers" },
    async ({ actor }) => {
      const result = listCarriers(actor);
      return NextResponse.json(result);
    },
    req,
  );
}

/** POST /api/v1/carriers — add a carrier */
export async function POST(req: NextRequest) {
  return withAuth(
    { method: "POST", path: "/carriers", access: "auth", permission: "carrier:manage", audited: true, description: "Add a carrier" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zCarrierCreateInput.safeParse(body);
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
      const carrier = createCarrier(actor, parsed.data);
      return NextResponse.json({ data: carrier }, { status: 201 });
    },
    req,
  );
}
