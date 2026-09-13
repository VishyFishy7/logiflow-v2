import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zShipmentListQuery, zShipmentCreateInput } from "@logiflow/contracts";
import { listShipments, createShipment, getDb, tenants } from "@/lib/db-lazy";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/shipments — list shipments */
export async function GET(req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/shipments", access: "auth", permission: "shipment:read_assigned", scope: "assigned", description: "List shipments" },
    async ({ actor }) => {
      const url = new URL(req.url);
      const raw: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { raw[k] = v; });
      const parsed = zShipmentListQuery.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "Invalid query parameters" } }, { status: 400 });
      }
      const result = await listShipments(actor, parsed.data);
      return NextResponse.json(result);
    },
    req,
  );
}

/** POST /api/v1/shipments — create a shipment */
export async function POST(req: NextRequest) {
  return withAuth(
    { method: "POST", path: "/shipments", access: "auth", permission: "shipment:create", audited: true, description: "Create a shipment" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zShipmentCreateInput.safeParse(body);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) { fieldErrors[issue.path.join(".")] = issue.message; }
        return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "Invalid input", fieldErrors } }, { status: 400 });
      }
      const db = getDb();
      const tenant = db.select().from(tenants).where(eq(tenants.id, actor.tenantId)).get();
      const prefix = tenant?.trackingPrefix ?? "LF";
      const shipment = await createShipment(actor, parsed.data as any, prefix);
      return NextResponse.json({ data: shipment }, { status: 201 });
    },
    req,
  );
}
