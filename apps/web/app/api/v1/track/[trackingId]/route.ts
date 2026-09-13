import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { lookupPublicTracking, type BrandResolver, getDb, tenants } from "@logiflow/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const brandResolver: BrandResolver = (tenantId: string) => {
  const db = getDb();
  const tenant = db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
  if (!tenant) return null;
  return { companyName: tenant.companyName, productName: tenant.productName, supportEmail: tenant.supportEmail, trackingPrefix: tenant.trackingPrefix };
};

/** GET /api/v1/track/:trackingId — public tracking lookup */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ trackingId: string }> }) {
  const { trackingId } = await params;
  return withAuth(
    { method: "GET", path: "/track/:trackingId", access: "public", description: "Public tracking lookup" },
    async () => {
      try {
        const result = lookupPublicTracking(trackingId, brandResolver);
        return NextResponse.json(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Not found";
        return NextResponse.json({ error: { code: "NOT_FOUND", message } }, { status: 404 });
      }
    },
    _req,
    { trackingId },
  );
}
