import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zVocabularyInput } from "@logiflow/contracts";
import { updateDelayReasons, updateLeadSources, getDb, tenants } from "@/lib/db-lazy";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/v1/settings/vocabulary — update vocabularies */
export async function PATCH(req: NextRequest) {
  return withAuth(
    { method: "PATCH", path: "/settings/vocabulary", access: "auth", permission: "settings:manage", audited: true, description: "Update vocabularies" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zVocabularyInput.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: "VALIDATION_FAILED", message: "Invalid input" } },
          { status: 400 },
        );
      }
      const db = getDb();
      if (parsed.data.delayReasons) {
        updateDelayReasons(actor, parsed.data.delayReasons);
      }
      if (parsed.data.leadSources) {
        updateLeadSources(actor, parsed.data.leadSources);
      }
      const tenant = db.select().from(tenants).where(eq(tenants.id, actor.tenantId)).get();
      return NextResponse.json({ data: tenant });
      return NextResponse.json({ data: tenant });
    },
    req,
  );
}
