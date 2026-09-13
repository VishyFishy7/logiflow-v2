import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zTenantUpdateInput } from "@logiflow/contracts";
import { getDb, tenants } from "@logiflow/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/v1/settings/tenant — timezone / currency */
export async function PATCH(req: NextRequest) {
  return withAuth(
    { method: "PATCH", path: "/settings/tenant", access: "auth", permission: "billing:manage", audited: true, description: "Timezone / currency" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zTenantUpdateInput.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: "VALIDATION_FAILED", message: "Invalid input" } },
          { status: 400 },
        );
      }
      const db = getDb();
      const now = Date.now();
      const patch: Record<string, unknown> = { updatedAt: now };
      if (parsed.data.timezone !== undefined) patch.timezone = parsed.data.timezone;
      if (parsed.data.currency !== undefined) patch.currency = parsed.data.currency;
      db.update(tenants).set(patch).where(eq(tenants.id, actor.tenantId)).run();
      const tenant = db.select().from(tenants).where(eq(tenants.id, actor.tenantId)).get();
      return NextResponse.json({ data: tenant });
      return NextResponse.json({ data: tenant });
    },
    req,
  );
}
