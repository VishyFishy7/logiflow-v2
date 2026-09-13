import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/webhooks/carriers/:code — carrier webhook (HMAC) */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: `Webhook for carrier ${code} not implemented` } },
    { status: 501 },
  );
}
