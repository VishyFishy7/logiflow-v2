import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/shipments/stats — shipment aggregates */
export async function GET(req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/shipments/stats", access: "auth", permission: "analytics:view", description: "Shipment aggregates" },
    async ({ actor }) => {
      // Delegate to the stats repository (simplified for now)
      return NextResponse.json({
        kpis: [],
        shipmentsByStatus: [],
        volumeByDay: [],
        delayReasons: [],
        needsAttention: { delayedShipments: [], overdueInvoices: [], followUpsToday: [] },
        heatmap: [],
      });
    },
    req,
  );
}
