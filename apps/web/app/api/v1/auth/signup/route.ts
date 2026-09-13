import { NextRequest, NextResponse } from "next/server";
import { zSignupInput } from "@logiflow/contracts";
import { hashPassword, getDb, users, tenants } from "@logiflow/db";
import { newId } from "@logiflow/shared";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/auth/signup — create a tenant + owner account */
export async function POST(req: NextRequest) {
  const parse = zSignupInput.safeParse(await req.json());
  if (!parse.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parse.error.issues) {
      fieldErrors[issue.path.join(".")] = issue.message;
    }
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Invalid input", fieldErrors } },
      { status: 400 },
    );
  }

  const { name, email, password, companyName, trackingPrefix } = parse.data;
  const db = getDb();
  const now = Date.now();

  const existing = db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  if (existing) {
    return NextResponse.json(
      { error: { code: "EMAIL_ALREADY_EXISTS", message: "A user with this email already exists" } },
      { status: 409 },
    );
  }

  const tenantId = newId();
  const userId = newId();
  const passwordHash = hashPassword(password);
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);

  db.transaction((tx: any) => {
    tx.insert(tenants).values({
      id: tenantId, slug, companyName, productName: companyName, tagline: "", trackingPrefix,
      supportEmail: email, themePrimary: "#0284c7", themePrimaryDark: "#0ea5e9",
      themeAccent: "#0284c7", themeSidebarBg: "#0c4a6e", timezone: "Asia/Kolkata",
      currency: "INR", plan: "trial", maskPolicy: "last2", publicTrackingEnabled: true,
      delayReasons: ["Traffic congestion", "Weather conditions", "Other"],
      leadSources: ["Referral", "Website"], createdAt: now,
    }).run();

    tx.insert(users).values({
      id: userId, tenantId, name, email: email.toLowerCase(), role: "owner",
      passwordHash, active: true, createdAt: now, updatedAt: now,
    }).run();
  });

  return NextResponse.json({ data: { id: userId, email, name, role: "owner" } }, { status: 201 });
}
