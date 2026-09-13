import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/auth/logout — end the session */
export async function POST(_req: NextRequest) {
  await signOut({ redirect: false });
  return NextResponse.json({ ok: true });
}
