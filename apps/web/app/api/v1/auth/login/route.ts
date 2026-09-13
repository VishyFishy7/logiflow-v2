import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/auth/login — sign in with credentials */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Email and password are required" } },
      { status: 400 },
    );
  }

  const result = await signIn("credentials", {
    email,
    password,
    redirect: false,
  });

  if (result?.error) {
    return NextResponse.json(
      { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
