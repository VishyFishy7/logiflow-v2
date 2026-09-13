import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zBrandUpdateInput } from "@logiflow/contracts";
import { updateTenantBrand } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/v1/settings/brand — update brand */
export async function PATCH(req: NextRequest) {
  return withAuth(
    { method: "PATCH", path: "/settings/brand", access: "auth", permission: "settings:manage", audited: true, description: "Update brand" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zBrandUpdateInput.safeParse(body);
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
      const tenant = updateTenantBrand(actor, parsed.data);
      return NextResponse.json({ data: tenant });
    },
    req,
  );
}
