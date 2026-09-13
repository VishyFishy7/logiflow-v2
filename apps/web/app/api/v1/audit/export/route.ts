import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guard";
import { zAuditListQuery } from "@logiflow/contracts";
import { listAuditEvents } from "@/lib/db-lazy";
import { toCsv, type CsvColumn } from "@logiflow/shared";
import type { AuditEventDTO } from "@logiflow/contracts";

const AUDIT_CSV_COLUMNS: CsvColumn<AuditEventDTO>[] = [
  { id: "occurredAt", header: "Time", value: (r) => new Date(r.occurredAt).toISOString() },
  { id: "actorName", header: "Actor", value: (r) => r.actorName },
  { id: "action", header: "Action", value: (r) => r.action },
  { id: "entityType", header: "Entity type", value: (r) => r.entityType },
  { id: "entityLabel", header: "Entity", value: (r) => r.entityLabel },
  { id: "severity", header: "Severity", value: (r) => r.severity },
  { id: "summary", header: "Summary", value: (r) => r.summary },
  { id: "source", header: "Source", value: (r) => r.source },
];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/audit/export — CSV export */
export async function GET(req: NextRequest) {
  return withAuth(
    { method: "GET", path: "/audit/export", access: "auth", permission: "audit:export", audited: true, description: "CSV export" },
    async ({ actor }) => {
      const url = new URL(req.url);
      const raw: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { raw[k] = v; });
      const parsed = zAuditListQuery.safeParse({ ...raw, page: 1, pageSize: 5000 });
      const query = parsed.success ? parsed.data : { page: 1, pageSize: 5000 } as any;
      const result = await listAuditEvents(actor, query);
      const csv = toCsv(result.data, AUDIT_CSV_COLUMNS);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="audit.csv"',
        },
      });
    },
    req,
  );
}
