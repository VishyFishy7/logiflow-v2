import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zTrackingSettingsInput } from "@logiflow/contracts";
import { updateTrackingSettings } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/v1/settings/tracking — update tracking settings */
export async function PATCH(req: NextRequest) {
  return withAuth(
    { method: "PATCH", path: "/settings/tracking", access: "auth", permission: "settings:manage", audited: true, description: "Update tracking settings" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zTrackingSettingsInput.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: "VALIDATION_FAILED", message: "Invalid input" } },
          { status: 400 },
        );
      }
      const tenant = updateTrackingSettings(actor, parsed.data);
      return NextResponse.json({ data: tenant });
    },
    req,
  );
}
