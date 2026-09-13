# LogiFlow v2 — Build Reference (authoritative interfaces)

Everything in this file is **verified against the code that exists**. Code written for this
repo must match these signatures exactly. Never invent a table column, a DTO field, or a
helper name: the sources listed here are the truth.

- `docs/PRD.md` — the PRD. Authoritative for product behaviour and decisions.
- `packages/db-schema.md` — generated dump of every table and column as it actually exists.
- `packages/db/migrations/0000_init.sql` — the DDL that has been **applied** to `data/logiflow.db`.

## 0. Commands

```bash
cd ~/projects/logiflow-v2

pnpm install                 # workspace install
pnpm -r typecheck            # tsc --noEmit in every package that declares it
pnpm --filter @logiflow/db typecheck
pnpm --filter @logiflow/db migrate     # tsx src/migrate.ts (forward-only)
pnpm --filter @logiflow/db seed        # tsx src/seed.ts
pnpm dev                     # web app, NEXT_PUBLIC_API_MODE=mock   (port 3000)
pnpm dev:live                # web app against the real API mode
pnpm test                    # vitest run (root config)
```

Gate for every task: **`pnpm --filter @logiflow/db typecheck` and
`pnpm --filter @logiflow/contracts typecheck` must be clean for the files you own.** Other
people are editing other files in the same package concurrently — if you see errors in a
file you do not own, ignore them; never "fix" someone else's file.

## 1. Layout and import rules

```
apps/web                 Next.js 15 (App Router, TS, Tailwind v4, React 19)
packages/shared          primitives — no DB, no React, no Next
packages/contracts       transport shapes — zod schemas, enums, route table
packages/db              schema, migrations, repositories, services (node-only)
docs/                    PRD.md, PLAN.md, REFERENCE.md, ADRs
tests/                   cross-package tests (vitest)
```

- Workspace packages are consumed as **source**: `"main"/"types" → src/index.ts`. No build step.
- Cross-package import: `import { newId } from "@logiflow/shared";`
- **Within** a package use explicit `.js` extensions on relative imports
  (`from "./schema/index.js"`, `from "./client.js"`) — required by the ESM/tsx setup.
- Path alias `@/*` in `apps/web` → `apps/web/*` (use it for app-internal imports).
- Strict TS: `strict`, `noUncheckedIndexedAccess`, `skipLibCheck`. No `any` without a comment.

## 2. `@logiflow/db` — the layer every repository is built on

### Client (`src/client.ts`)

```ts
export const sqlite: Database;      // better-sqlite3, WAL, foreign_keys=ON
export const db: DrizzleDb;         // drizzle(sqlite, { schema })
export type Db, Tx, Executor;       // Executor = Db | Tx  ← repositories accept either
export { schema };
```

**Driver rule (non-negotiable):** `better-sqlite3` is synchronous. `await` on a query works
outside a transaction, but a **transaction callback must not be `async`**. Use:

```ts
db.transaction((tx) => {
  tx.insert(shipments).values(row).run();
  recordAudit(tx, actor, { ... });
});
```

Inside a transaction use `.run()` / `.get()` / `.all()`. `recordAudit` takes the `Executor`, so
the audit row commits with the mutation it describes — there is no other way to write audit.

### Actor / scope (`src/actor.ts`)

```ts
interface Actor {
  userId; tenantId; name; email;
  role: Role; permissions: Permission[];
  requestId; source: AuditSource; reveal: boolean;
  ip?: string | null; userAgent?: string | null;
}
systemActor(tenantId, requestId, source: AuditSource = "job"): Actor

type ShipmentVisibility = "all" | "own_clients" | "assigned" | "none";
shipmentVisibility(actor): ShipmentVisibility
visibilityCondition(actor, visibility?): SQL | undefined   // undefined = no restriction
shipmentScopeCondition(actor, permission): SQL | undefined // write side
leadVisibility(actor): ShipmentVisibility
scopeAllowsRow(actor, permission, { assignedTo?, createdBy?, clientCreatedBy? }): boolean
andAll(...conds: (SQL | undefined)[]): SQL | undefined
decideScope(role, permission): { grant: Grant; all: boolean }
```

Row visibility order (PRD §7.2): `shipment:read_all` = `all` → tenant-wide;
= `own_clients` → clients the actor created; else `shipment:read_assigned` → own rows; else none.
`actor.reveal` is the **only** input to masking — never re-derive it from the role.

### Audit (`src/audit.ts`)

```ts
interface AuditEntry {
  action: string;                 // must exist in contracts AUDIT_ACTIONS
  entityType: string; entityId: string; entityLabel: string;
  summary: string;                // human sentence, shown in the audit log
  severity?: AuditSeverity;       // "info" | "notice" | "warning" | "critical"
  changes?: Record<string, { from: unknown; to: unknown }> | null;
}
recordAudit(exec: Executor, actor: Actor | AuditActorRef, entry: AuditEntry): string
diffChanges(before, after): Record<string, {from,to}> | null   // null when nothing changed
```

### Errors (`src/errors.ts`)

```ts
class ApiError extends Error { code: ApiErrorCode; fieldErrors?; detail?; get status(): number; toBody(requestId?) }
notFound(code: ApiErrorCode, message): ApiError
validationFailed(message, fieldErrors?): ApiError
```

Every failure path throws `ApiError` with a code from `API_ERROR_CODES`; the HTTP status comes
from `ERROR_STATUS`. Never `throw new Error()` out of a repository.

### Row → DTO mapping (`src/mapping.ts`) — always go through these

```ts
envelope(raw, policy: MaskPolicy, reveal: boolean): MaskedValueDTO
internalIdEnvelope(raw, reveal)          // our tracking ID
carrierIdEnvelope(raw, reveal)           // the carrier's docket number
displayOnly(raw, policy): string
rowToShipment(row, side: ShipmentSideData, { reveal, now? }): ShipmentDTO
rowToCheckpoint(row): CheckpointDTO
rowToClient(row, counts?: { shipmentCount?; outstandingPaise? }): ClientDTO
rowToCarrier(row, openShipments?): Carrier
rowToLead(row, side?: { assignedName?; activityCount? }, activities?): LeadDTO
rowToLeadActivity(row): LeadActivityDTO
rowToInvoice(row, side: { clientName; lineCount?; lines?; shipments? }, now?): InvoiceDTO
rowToNotification(row): NotificationDTO
rowToAuditEvent(row): AuditEventDTO
```

`ShipmentSideData` (what a shipment query must join for): `clientId, clientName, carrierId,
carrierCode, carrierName, assignedName?, assignedEmail?, assignedAvatar?, createdByName?,
checkpointCount?, invoiceCount?`.

## 3. `@logiflow/contracts` — the wire contract

- `enums.ts` — `as const` arrays + matching zod schemas (`zShipmentStatus`, `zInvoiceStatus`,
  `zLeadStatus`, `zJobType`, `zAuditSeverity`, `zThemePreference`, …). Use these, never a literal union.
- `entities.ts` — every read model (`ShipmentDTO`, `ClientDTO`, `ShipmentDetailDTO`,
  `DashboardStats`, `AnalyticsStats`, `SessionResponse`, `PublicTrackingResponse`, …). **Do not add
  a field** that is not in PRD §6.1.
- `common.ts`

```ts
interface ListEnvelope<T> { data: T[]; page: number; pageSize: number; total: number; totalPages: number }
listEnvelope(data, { page, pageSize, total }): ListEnvelope<T>   // ← build every list with this
zMaskedValue, zListQueryBase, zShipmentListQuery, zInvoiceListQuery, zLeadListQuery,
zAuditListQuery, zExportQuery, zListResponse, zItemResponse
API_ERROR_CODES, ERROR_STATUS, type ApiErrorCode
```

- `inputs.ts` — request payload schemas. Every mutating route parses one of these at the edge.
- `routes.ts` — the route table: one declaration drives the auth guard, the permission-matrix
  test (7 roles × every endpoint) and the MSW mock handlers.
- `audit-actions.ts` — the closed `action` key namespace for `recordAudit`.

Lists return `ListEnvelope<T>`; single items return `{ data: T }`; errors return
`{ error: { code, message, fieldErrors?, requestId? } }`.

## 4. `@logiflow/shared` — the primitives (exact exports)

**tracking.ts** — `TRACKING_BODY_LENGTH`, `TRACKING_ALPHABET`, `generateTrackingBody(len?)`,
`generateTrackingId(prefix)`, `normalisePrefix`, `isValidPrefix`, `normaliseTrackingId`,
`parseTrackingId`, `isPlausibleTrackingId`, `isPlausibleCarrierTrackingId`,
`normaliseCarrierTrackingId`.

**rbac.ts** — `ROLES`, `Role`, `ROLE_LABELS`, `ROLE_DESCRIPTIONS`, `PERMISSIONS`, `Permission`,
`Grant = "all" | "assigned" | "own_clients" | "deny"`, `MATRIX`, `permissionsFor(role)`,
`grantFor(role, permission)`, `can(role, permission)`, `grantsAll(role, permission)`, `isRole`,
`ASSIGNABLE_ROLES`, `roleRank(role)`.

**money.ts** — `PAISE_PER_RUPEE`, `rupeesToPaise`, `paiseToRupees`, `formatMoney(paise, "INR"|"USD")`,
`formatMoneyPlain(paise)`, `formatMoneyCompact(paise)`, `taxOn(amountPaise, taxRateBp)`,
`InvoiceTotals`, `computeInvoiceTotals(...)`, `formatWeight(grams)`, `kgToGrams(kg)`.
**All money is integer paise. No floats anywhere.**

**dates.ts** — `DEFAULT_TIMEZONE` (`Asia/Kolkata`), `toLocalDateKey(ms, tz?)`, `formatDateIst`,
`formatDateTimeIst`, `formatTimeIst`, `formatDateTimeSql`, `formatAuditTime(ms, now?)`,
`formatRelative`, `daysBetween`, `startOfLocalDay`, `addDays(ms, days)`, `todayAt(hour, minute?)`,
`isoDate`. **All timestamps are UTC milliseconds (integers)**; display formatting only through
these helpers — never `Date#getHours()`.

**mask.ts** — `MaskPolicy = "last2" | "first2_last2" | "full" | "none"`, `MASK_BULLET`,
`maskSecret(value, policy)`, `INTERNAL_ID_POLICY` (`last2`), `CARRIER_ID_POLICY` (`first2_last2`),
`maskTrackingId`, `maskCarrierTrackingId`, `MaskedValue { value; raw?; masked; policy }`,
`asMaskedValue(raw, policy)`, `REDACTED_LOG_PATHS`.

**ids.ts** — `newId()` (cuid2), `newPrefixedId(prefix)`, `newRequestId()`, `newInviteToken()`,
`newStorageKey(filename)`, `formatInvoiceNumber(year, sequence)`.

**csv.ts** — `escapeCsvCell(value)`, `CsvColumn<T> { id: string; header: string; value: (row: T) => unknown }`,
`toCsv(rows, columns)`, `toJsonLines(rows)`, `exportFilename(prefix, now?)`.
Formula injection is handled inside `escapeCsvCell` — never build CSV by hand.

**brand.ts** — `BrandConfig`, `DEFAULT_BRAND`, `TenantBrandSource`, `BrandEnvOverride`,
`resolveBrand(...)`, `brandThemeCss(brand)`.

## 5. Database conventions

- Tables and columns: `packages/db-schema.md`. Money `*Paise` integers; times `*At` UTC ms
  integers; ids are `text` cuid2 (no auto-increment, so the schema ports to Postgres);
  JSON columns are `text` with `{ mode: "json" }`.
- Migrations are forward-only appends in `packages/db/migrations/` (`0001_*.sql`, …), applied by
  `src/migrate.ts`. Do not edit `0000_init.sql` — it is already applied to the dev database.
- `audit_events` is append-only: triggers reject `UPDATE` and `DELETE`.
- Every mutating repository function: validate → `db.transaction((tx) => { … .run(); recordAudit(tx, …) })`.
- Repositories take `actor: Actor` first; they are the only place SQL lives.

## 6. Web app conventions (`apps/web`)

- Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS v4 (CSS-first `@theme` in
  `app/globals.css`), Turbopack. Server Components by default; `"use client"` only for
  interaction.
- Design system: **Spectrum UI** (`https://ui.spectrumhq.in/r/<name>.json`) — PRD §3. Install
  per-screen, not in advance.
- Theming: PRD §12 (light/dark token architecture, status colour tokens). Design intent: PRD §3.5.
- Tables: PRD §11 (one table engine, the component's real props are listed in §11.2 — use those
  props and no others; per-page config §11.3; shared list query §11.5; empty/loading/error §11.6;
  audit log §11.7).
- Layout/`board` shell: PRD §10. Screens: PRD §14 (route-for-route with v1, §2.1). Mobile: §13.
- Locale: PRD §12.7. Icons/typography/radii: PRD §12.5. Contrast: §12.6.
- `NEXT_PUBLIC_API_MODE=mock` must serve the entire UI from the contract-first mock layer
  (PRD §9.7) with no database; `=live` talks to the real route handlers.
- Components: shadcn-style registry components live in `apps/web/components/ui/*`; product
  components in `apps/web/components/<domain>/*`. Cards over tables for list views; amounts are
  headline numbers, not status-coloured cards; accent is sky blue, never green except success.

## 7. Quality gate for any task

1. `pnpm --filter <pkg> typecheck` clean for the files you touched.
2. Behaviour you claim must be run: execute the script/test and paste the real output.
3. Tests live in `tests/` (vitest, node env) or `*.test.ts` beside the unit. PRD §19 lists the
   acceptance matrix — a claim against it needs a test that fails when the behaviour is removed.
4. No placeholder implementations, no `TODO`, no fabricated output. If something cannot be done,
   say so in the report.
