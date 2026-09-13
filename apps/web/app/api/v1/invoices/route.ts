import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zInvoiceListQuery, zInvoiceCreateInput } from "@logiflow/contracts";
import { listInvoices, createInvoice } from "@/lib/db-lazy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/invoices — list invoices */
export async function GET(req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/invoices", access: "auth", permission: "invoice:read", description: "List invoices" },
    async ({ actor }) => {
      const url = new URL(req.url);
      const raw: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { raw[k] = v; });
      const parsed = zInvoiceListQuery.safeParse(raw);
      const query = parsed.success ? parsed.data : { page: 1, pageSize: 25 } as any;
      const result = await listInvoices(actor, query);
      return NextResponse.json(result);
    },
    req,
  );
}

/** POST /api/v1/invoices — create an invoice */
export async function POST(req: NextRequest) {
  return withAuth(
    { method: "POST", path: "/invoices", access: "auth", permission: "invoice:manage", audited: true, description: "Create an invoice" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zInvoiceCreateInput.safeParse(body);
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
      const invoice = await createInvoice(actor, parsed.data);
      return NextResponse.json({ data: invoice }, { status: 201 });
    },
    req,
  );
}
