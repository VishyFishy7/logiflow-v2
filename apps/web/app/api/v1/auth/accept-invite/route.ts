import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/auth/accept-invite — set password from invite token */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Invite flow not yet implemented" } },
    { status: 501 },
  );
}
