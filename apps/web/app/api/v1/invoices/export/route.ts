import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { listInvoices } from "@logiflow/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/invoices/export — CSV export */
export async function GET(req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/invoices/export", access: "auth", permission: "invoice:read", audited: true, description: "CSV export" },
    async ({ actor }) => {
      const result = await listInvoices(actor, { page: 1, pageSize: 10000 } as any);
      const csv = "Invoice Number,Client,Status,Total\n" + (result.data as any[]).map((i: any) => `${i.number},${i.client?.name ?? ""},${i.status},${i.totalPaise}`).join("\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="invoices.csv"',
        },
      });
    },
    req,
  );
}
