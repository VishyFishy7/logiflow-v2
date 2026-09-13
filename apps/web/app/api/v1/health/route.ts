import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/health — liveness check */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    mode: "live",
    version: "2.0.0",
  });
}
