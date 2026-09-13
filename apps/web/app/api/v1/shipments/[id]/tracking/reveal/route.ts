import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { getDb, shipments, recordAudit, internalIdEnvelope, carrierIdEnvelope } from "@/lib/db-lazy";
import { eq, and, isNull } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/shipments/:id/tracking/reveal — reveal raw tracking IDs */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "POST", path: "/shipments/:id/tracking/reveal", access: "auth", permission: "tracking:reveal", audited: true, description: "Reveal raw tracking IDs" },
    async ({ actor }) => {
      const db = getDb();
      const row = db.select().from(shipments).where(
        and(eq(shipments.id, id), eq(shipments.tenantId, actor.tenantId), isNull(shipments.deletedAt)),
      ).get();
      if (!row) {
        return NextResponse.json(
          { error: { code: "SHIPMENT_NOT_FOUND", message: "Shipment not found" } },
          { status: 404 },
        );
      }

      recordAudit(db, actor, {
        action: "tracking.revealed",
        entityType: "tracking",
        entityId: id,
        entityLabel: row.trackingId,
        summary: `Revealed tracking IDs for ${row.trackingId}`,
        severity: "warn",
      });

      return NextResponse.json({
        data: {
          shipmentId: id,
          trackingId: internalIdEnvelope(row.trackingId, true),
          carrierTrackingId: carrierIdEnvelope(row.carrierTrackingId, true),
          revealSeconds: 300,
        },
      });
    },
    _req,
    { id },
  );
}
