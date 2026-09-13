import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { getTenant } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/settings — tenant settings */
export async function GET(_req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/settings", access: "auth", permission: "settings:manage", description: "Tenant settings" },
    async ({ actor }) => {
      const tenant = getTenant(actor.tenantId);
      if (!tenant) {
        return NextResponse.json(
          { error: { code: "TENANT_NOT_FOUND", message: "Tenant not found" } },
          { status: 404 },
        );
      }
      return NextResponse.json({
        id: tenant.id,
        slug: tenant.slug,
        companyName: tenant.companyName,
        productName: tenant.productName,
        tagline: tenant.tagline,
        trackingPrefix: tenant.trackingPrefix,
        supportEmail: tenant.supportEmail,
        themePrimary: tenant.themePrimary,
        themePrimaryDark: tenant.themePrimaryDark,
        themeAccent: tenant.themeAccent,
        themeSidebarBg: tenant.themeSidebarBg,
        timezone: tenant.timezone,
        currency: tenant.currency,
        plan: tenant.plan,
        maskPolicy: tenant.maskPolicy,
        publicTrackingEnabled: tenant.publicTrackingEnabled,
        delayReasons: (tenant.delayReasons ?? []) as string[],
        leadSources: (tenant.leadSources ?? []) as string[],
        createdAt: tenant.createdAt,
      });
    },
    _req,
  );
}
