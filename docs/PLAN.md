# LogiFlow v2 — implementation plan

Derived from `docs/PRD.md` (§16 milestones). Each milestone ends with tests passing and a demoable state.

## Frozen decisions (from the PRD — not re-litigated)

- pnpm workspace monorepo: `apps/web` (Next.js 15 App Router, React 19, TS strict) + `packages/{contracts,db,shared}`.
- Tailwind v4 + shadcn/ui + **Spectrum UI registry** copied into `components/spectrumui/`.
- SQLite via Drizzle + better-sqlite3 locally; Postgres-ready schema rules (§4.2).
- Auth.js v5 Credentials + DB sessions + argon2id.
- Zod contracts shared by route handlers, the typed `api` client and the MSW mock layer.
- REST `/api/v1/**`, list envelope `{data,page,pageSize,total,totalPages}`, one error shape.
- One table engine: `@spectrumui/data-table` everywhere. No raw `<table>`.
- Audit log: append-only, written in the same transaction as the mutation.
- Masking server-side; reveal is an audited endpoint.
- Tokens only; sky-blue accent; green reserved for success states; Inter + JetBrains Mono.

## Registry reality (verified against `https://ui.spectrumhq.in/r/*.json`, 272 items)

| PRD name | Registry item actually installed |
|---|---|
| `@spectrumui/data-table` | `data-table` → `components/spectrumui/data-table.tsx` |
| `@spectrumui/audit-log-table` | `audit-log-table` → `components/spectrumui/blocks/tables/audit-log-table.tsx` |
| `@spectrumui/status-badge` | `status-badge` → `components/spectrumui/statusdemo.tsx` |
| `@spectrumui/status-tracker` | `status-tracker` → `components/spectrumui/blocks/ai-assistants/status-tracker.tsx` |
| `@spectrumui/stat-cards` | `stat-cards` (+ `chart-engine.tsx`) |
| `@spectrumui/animated-drawer` | `animated-drawer` (vaul) |
| `@spectrumui/multiple-selector` | `multiple-selector-dependencies` (async-search + creatable variants) |
| `@spectrumui/autosize-textarea` | `autosize-textarea-dependecies` |
| `@spectrumui/datetime-picker` | `datetime-picker-demo` / `datetime-picker-and-time-input` |

Deviations are recorded in `docs/DESIGN-NOTES.md` as they happen (§3.2 rule 2).

## Milestones

| # | Milestone | State |
|---|---|---|
| 0 | Scaffold — workspace, Next 15, Tailwind v4, shadcn init, Spectrum registry, theme provider + toggle, token layer, dev-only design page | in progress |
| 1 | Contracts & DB — Zod schemas, enums, audit actions; Drizzle schema, migration, repositories; deterministic seed | pending |
| 2 | Auth + shell — Auth.js v5, `withAuth` choke point, RBAC matrix, app shell (sidebar/topbar/tab navbar/command palette) | pending |
| 3 | Shipments — list (table engine, URL filters), create flow, detail (overview, tracking reveal, timeline, log-status drawer) | pending |
| 4 | Audit log — `audit_events`, `recordAudit` wired everywhere, `/audit` table per §11.7, exports | pending |
| 5 | Invoices & clients — CRUD, lines, totals, statuses, exports | pending |
| 6 | Leads — kanban + table, drawer, activity feed, conversion | pending |
| 7 | Team, settings, brand — team management, tenant brand, tracking settings, vocabularies | pending |
| 8 | Dashboard, analytics, notifications — KPI cards, charts, needs-attention, notification centre | pending |
| 9 | Public tracking + carriers — `/track/[trackingId]`, rate limiting, mock adapter, typed stubs | pending |
| 10 | Hardening — vitest suites (RBAC matrix, tracking, money), axe/Lighthouse notes, API.md + openapi.json, README, ADRs | pending |

## Parallel lanes (after the foundation is frozen)

Foundation (this session, sequential): scaffold → tokens → shared → contracts → db → auth → api client.
Then lanes, one route-tree each, so no two lanes write the same file:

- L1 shipments (`app/(app)/shipments/**`, `components/app/shipment-*`)
- L2 audit (`app/(app)/audit/**`, `components/app/audit-*`)
- L3 invoices + clients
- L4 leads
- L5 team + settings + brand
- L6 dashboard + analytics + notifications
- L7 public tracking + carrier adapters
