# LogiFlow v2

A multi-tenant B2B logistics operations platform — the Five Logistics pilot. One
workspace to run the whole consignment lifecycle: quote → booking → carrier
handover → checkpoints → delivery → invoice, with sales pipeline, partner
ledgers, an append-only audit trail and role-based access on top.

**Live demo:** https://logiflow-v2.vercel.app — opens straight into the demo
workspace in mock mode (no server, no database, no signup).

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 15 (App Router), React 19, TypeScript strict |
| Styling | Tailwind v4, shadcn/ui + **Spectrum UI** registry components in `components/spectrumui/` |
| State | React Query for server data, URL for list filters, zustand (persisted) for the two UI preferences |
| Contracts | zod schemas in `packages/contracts` — shared by route handlers, the typed client and the MSW mock layer |
| Data | SQLite via Drizzle ORM + better-sqlite3 locally; schema follows the Postgres-ready rules (§4.2) |
| Auth | Auth.js v5 Credentials, DB sessions, argon2id hashes |
| Mocks | MSW — every `/api/v1/*` endpoint has a handler generated from the shared route table |
| Tests | vitest (214 tests across shared, contracts and db) |

## Layout

```
apps/web          Next.js app — routes, components, mocks
packages/shared   primitives: money, dates, masking, RBAC, tracking ids, csv
packages/contracts zod schemas, enums, DTOs, the API route table, demo fixtures
packages/db       schema, migrations, repositories, services
docs/             PRD, plan, reference, UI patterns, QA findings
```

## Quick start

```bash
pnpm install

# Demo mode — the browser is served entirely from MSW handlers.
pnpm dev                       # http://localhost:3000

# Live mode — real route handlers on top of SQLite.
pnpm db:setup                  # create data/logiflow.db, migrate, seed
pnpm dev:live
```

Mock mode is the default and needs no database: sign in with any demo account
below and every screen behaves as if the API were real (writes persist in the
browser for the session).

### Demo accounts

Password for all of them: `LogiFlow@2026`

| Role | Email |
| --- | --- |
| Owner | aarav@fivelogistics.in |
| Admin | priya@fivelogistics.in |
| Ops manager | rohit@fivelogistics.in |
| Dispatcher | sneha@fivelogistics.in |
| Accounts | vikram@fivelogistics.in |
| Sales | neha@fivelogistics.in |
| Viewer | imran@fivelogistics.in |

Each role sees a different shell: navigation, action buttons and bulk operations
are gated by the same `role → permission` map the API enforces
(`packages/shared/src/rbac.ts`).

## Surfaces

| Route | What it is |
| --- | --- |
| `/dashboard` | Home. KPI cards, status distribution, needs-attention queue, recent movements, insights |
| `/shipments` | The consignment register — paged table, saved filters, bulk assign/status, CSV export |
| `/shipments/new` | Create a consignment; quote estimate, client and route capture |
| `/shipments/[id]` | One consignment: checkpoint timeline, carrier booking, sync, cost breakdown, audit trail |
| `/leads` | Sales pipeline board (drag between stages, keyboard/touch stage change), lead detail drawer |
| `/clients` | Client register with outstanding balances and shipment history |
| `/carriers` | Carrier network — modes, service levels, webhook secret rotation |
| `/invoices` | Invoice register, overdue tracking, line items, CSV export |
| `/analytics` | Volume, revenue, delay and lane performance over the period |
| `/audit` | Append-only audit log — pinned and paged views, field-level diffs, JSONL/CSV export |
| `/team` | Members, roles, invites |
| `/settings` | Tenant, brand (product name/tracking prefix), tracking rules, vocabulary |
| `/profile` | Your name, phone, password, active sessions |
| `/track/[code]` | Public customer-facing tracking page — no login, masked identifiers |

`/` redirects to `/dashboard`; every authenticated surface lives under the
`(app)` segment so the shell (sidebar, topbar, command palette, notifications)
mounts once.

## Commands

```bash
pnpm dev          # mock mode on :3000
pnpm dev:live     # live mode against SQLite
pnpm build        # production build
pnpm typecheck    # tsc --noEmit across the workspace
pnpm test         # vitest run
pnpm db:setup     # migrate + seed
pnpm db:seed      # reset the demo dataset
pnpm db:export    # dump a snapshot of every table
pnpm lint
```

## Deployment

The web app deploys on Vercel with no database: `NEXT_PUBLIC_API_MODE` defaults
to `mock`, so the deployed build serves every request from the MSW handlers and
the demo is fully interactive. Live mode (SQLite + better-sqlite3) runs locally
or on a node host with a writable disk — Vercel's filesystem is read-only, so
point `DATABASE_URL` at Postgres and run migrations there before switching a
deployment to `NEXT_PUBLIC_API_MODE=live`.

## Docs

- `docs/PRD.md` — the product spec this build implements
- `docs/PLAN.md` — milestones, frozen decisions, registry mapping
- `docs/REFERENCE.md` — authoritative interfaces: commands, layer rules, conventions
- `docs/UI_PATTERNS.md` — how every screen is assembled (read before adding one)
- `docs/QA-FINDINGS.md` — QA pass: defects found, root causes, fixes, coverage
