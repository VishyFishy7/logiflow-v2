import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zCheckpointCreateInput } from "@logiflow/contracts";
import { listCheckpoints, logStatus } from "@/lib/db-lazy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/shipments/:id/checkpoints — checkpoint timeline */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "GET", path: "/shipments/:id/checkpoints", access: "auth", permission: "shipment:read_assigned", scope: "assigned", description: "Checkpoint timeline" },
    async ({ actor }) => {
      const checkpoints = await listCheckpoints(actor, id);
      return NextResponse.json({ data: checkpoints, page: 1, pageSize: checkpoints.length, total: checkpoints.length, totalPages: 1 });
    },
    _req,
    { id },
  );
}

/** POST /api/v1/shipments/:id/checkpoints — log a checkpoint */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "POST", path: "/shipments/:id/checkpoints", access: "auth", permission: "shipment:log_status", scope: "assigned", audited: true, description: "Log a checkpoint" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zCheckpointCreateInput.safeParse(body);
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
      const shipment = await logStatus(actor, id, {
        status: parsed.data.status,
        label: parsed.data.label,
        location: parsed.data.location,
        note: parsed.data.note,
        delayReason: parsed.data.delayReason,
        source: parsed.data.source,
      });
      return NextResponse.json({ data: shipment });
    },
    req,
    { id },
  );
}
