import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zInvoiceUpdateInput } from "@logiflow/contracts";
import { getInvoiceDetail, updateInvoice } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/invoices/:id — invoice detail */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "GET", path: "/invoices/:id", access: "auth", permission: "invoice:read", description: "Invoice detail" },
    async ({ actor }) => {
      const invoice = await getInvoiceDetail(actor, id);
      return NextResponse.json({ data: invoice });
    },
    _req,
    { id },
  );
}

/** PATCH /api/v1/invoices/:id — update status / lines */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(
    { method: "PATCH", path: "/invoices/:id", access: "auth", permission: "invoice:manage", audited: true, description: "Update status / lines" },
    async ({ actor }) => {
      const body = await req.json();
      const parsed = zInvoiceUpdateInput.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: "VALIDATION_FAILED", message: "Invalid input" } },
          { status: 400 },
        );
      }
      const invoice = await updateInvoice(actor, id, parsed.data as any);
      return NextResponse.json({ data: invoice });
    },
    req,
    { id },
  );
}
