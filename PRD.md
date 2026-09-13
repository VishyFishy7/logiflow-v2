# LogiFlow v2 — Project Requirement Document

**Product:** LogiFlow v2 (working title) — multi-tenant B2B logistics operations platform
**Pilot client:** Five Logistics
**Document type:** Build specification for an AI coding agent
**Owner:** Vishwas Patel (product design, frontend, UX) · Backend handover: full-stack engineer (freelance)
**Status:** Ready to feed to the agent — v1.0

---

## 0. How to use this document

This document is written to be pasted **in full, unmodified**, into an AI coding agent (Hermes) running **Fable 5.1** as the execution model. One document, one build.

**Agent protocol**

1. Read this document end to end before writing code. Do not skim sections 3, 6, 7, 8 and 12 — they are the ones that are usually guessed wrong.
2. Produce an implementation plan broken into the milestones listed in §16, then execute milestone by milestone.
3. Where this document is silent, choose the option that (a) keeps the local database working with zero external accounts, and (b) reads naturally to a Node/TypeScript full-stack engineer who has never seen this repo.
4. Where this document is explicit — component source, token names, table API, masking behaviour, permission keys — do not substitute a personal favourite. The design system is a hard requirement, not a suggestion.
5. Never leave a feature half-wired: every screen must render against real data contracts with a mock layer (§9.7), not hardcoded arrays inside components.
6. Do not invent credentials. `.env.example` carries placeholder values only.

**Definition of success for this document:** a working Next.js application, runnable with `pnpm install && pnpm db:setup && pnpm dev`, that reproduces the full v1 feature surface (reference in §2) with the visual and motion language of Spectrum UI (§3), a swappable dark/light/system theme, and a real audit log built on Spectrum UI's Data Table.

---

## 1. Product summary

LogiFlow is a SaaS operations platform for small and mid-sized logistics companies. It replaces the spreadsheet + WhatsApp + phone-call workflow that Indian freight forwarders and 3PL operators run today.

An operator uses LogiFlow to:

- Book a shipment and hand it to a carrier, capturing both **our** tracking ID and **the carrier's own** tracking ID.
- Move that shipment through a status chain (pickup → warehouse → in transit → delivered, with delayed as an off-path state) and keep a per-shipment checkpoint history.
- Track which customers (clients) generated which shipments, and what is owed for them (invoices).
- Work a sales pipeline (leads) in parallel to the operations desk.
- See who did what, when, from where — the audit log.
- Share a **public, login-free tracking page** with their own customers.

Every deployment can be white-labelled: company name, product name, tracking-ID prefix, support email and colours come from configuration, never from hardcoded strings in components.

**Multi-user, role-aware, mobile-first.** The desk operates from a laptop; the field (pickup drivers, warehouse staff) operates from a phone. Both are first-class.

### 1.1 What is wrong with v1 (and therefore what v2 must fix)

| # | v1 problem | v2 requirement |
|---|---|---|
| 1 | Front-end-only prototype. `src/data/mock.ts` is imported directly by pages; there is no data layer, so nothing can be handed to a backend engineer. | Real HTTP contracts + a typed mock layer that is swapped by an env flag, never by editing pages (§9). |
| 2 | No persistence. Refresh loses everything; there is no schema, no migration, no seed. | Local SQLite database with migrations and a one-command seed reproducing v1's demo dataset (§9.3). |
| 3 | Light theme only. `src/styles/global.css` defines one `:root` block of bespoke variables (`--brand-primary`, `--bg`, `--card`) with no `.dark` counterpart and no `prefers-color-scheme` handling. | Token-driven theming with light, dark and system modes, swappable at runtime, persisted, no flash on load (§12). |
| 4 | Hand-rolled primitives: `Modal.tsx`, `StatusBadge.tsx`, `StatCard.tsx`, `Highlight.tsx`, plus ~250 lines of ad-hoc buttons/badges/pills/forms in `global.css`. Every one is a maintenance liability and visually inconsistent with the rest. | No bespoke primitives. Every surface is a Spectrum UI component or a shadcn/ui primitive styled with design tokens (§3.4). |
| 5 | Tracking ID is a single string. There is no separation between our ID, the carrier's ID, and what a given role is allowed to see. | Two distinct identifiers per shipment plus a masking policy enforced server-side (§8). |
| 6 | Roles are two flat booleans (`owner`, `team_member`) with a 6-key permission matrix. No dispatcher, no accounts, no sales, no viewer. | Seven roles over a named permission-key matrix, enforced at one choke point and mirrored in the UI (§7). |
| 7 | Tables are hand-written `<table>` markup with inline row markup per page. Filtering, sorting, selection, pagination, column control and keyboard navigation are re-implemented (badly) three times. | One table engine — Spectrum UI's Data Table — across all list surfaces, with per-page configuration (§11). |
| 8 | No audit trail. Status changes, invoice edits and team changes are untraceable. | Append-only audit log with an immutable store, diff capture, and the Spectrum UI audit-facing surface (§11.7). |
| 9 | Responsive behaviour is a handful of `@media` rules (`1080px`, `900px`, `640px`) that reflow a desktop layout into a cramped one. | Mobile is designed, not squeezed: bottom tab bar, card rows replacing table rows, drawers instead of modals, thumb-reachable primary actions (§13). |
| 10 | No loading, empty, or error states — the UI renders final data instantly because it is local. | Explicit `loading` / `empty` / `error` / `partial` handling on every data surface (§14.2). |
| 11 | White-label config is a TS module (`src/config/brand.ts`). Changing a client's brand means a code change and a redeploy. | Tenant record in the database with an optional file override for local development (§6.3). |

---

## 2. Reference — the original project

The original product is the behavioural reference for v2. Keep its domain language, its field set, and its flows. Replace its implementation entirely.

| Item | Value |
|---|---|
| Product name (v1) | **LogiFlow** |
| Client / pilot | **Five Logistics** |
| Repository | `https://github.com/VishyFishy7/five-logistics` |
| Live prototype | `https://five-logistics.vercel.app` |
| Local checkout | `C:\Users\gamer\projects\five-logistics` (branch `main`, 2 commits: `b85fc73` initial prototype, `0722eb3` ignore rule) |
| Stack (v1) | Vite + React 18 + TypeScript SPA, `react-router-dom` v6, `recharts`, `lucide-react`, hand-written CSS (822-line `src/styles/global.css`) |
| Data layer (v1) | `src/data/mock.ts` → `src/store/AppContext.tsx` |
| Auth (v1) | Mock only — any password accepted, email must match an account |
| Tracking prefix | `5LX` (e.g. `5LX-DT58K7`) |
| Backend, database, carrier APIs | **None.** Front-end prototype only. |

### 2.1 v1 route map (must be preserved in v2, path-for-path)

| v1 route | Surface | Auth |
|---|---|---|
| `/login` | Mock login; sign-up creates an Owner account | public |
| `/track` | Public tracking lookup | **public, unauthenticated** |
| `/` | Dashboard | required |
| `/leads` | Sales pipeline | required |
| `/shipments` | Shipments list | required |
| `/shipments/:id` | Shipment detail | required |
| `/invoices` | Invoicing (hidden from roles without `canViewInvoices`) | required + permission |
| `/settings` | Settings (team, brand, preferences) | required |
| `*` | Redirect to `/` | — |

### 2.2 v1 roles and demo accounts (seed these in v2)

| Role (v1) | Email | Access |
|---|---|---|
| Owner / Admin | `priya@fivelogistics.in` | Everything — all shipments and leads, invoicing, team management |
| Team Member | `rahul@fivelogistics.in` | Assigned shipments and leads only, status logging |
| Team Member | `ananya@fivelogistics.in` | Same, different assigned work |
| Team Member | `vikram@fivelogistics.in` | Same — owns the delayed DTDC shipments |

v1 demo tracking IDs for the public page: `5LX-DT58K7` (delayed), `5LX-AX84Q2` (in transit), `5LX-CQ93T5` (delivered), `5LX-EF61M3` (pickup).

### 2.3 v1 source inventory (reference only — do not port these files)

| Path | What it holds | v2 fate |
|---|---|---|
| `src/types/index.ts` | `Role`, `User`, `Shipment`, `Checkpoint`, `Lead`, `LeadActivity`, `Invoice`, `AppNotification` | **Keep the domain vocabulary**, split across `packages/contracts/src/*` (§6) |
| `src/permissions.ts` | `RolePermissions` (6 booleans) + `ROLE_PERMISSIONS` matrix + `permissionsFor()` | **Replace** with the key-based matrix in §7.2; keep the data-driven shape |
| `src/constants.ts` | `CARRIERS`, `DELAY_REASONS`, `LEAD_SOURCES`, `SHIPMENT_STATUS_ORDER`, four `*_STATUS_META` colour maps, `ROLE_LABELS` | **Keep the vocabulary**, colours move into design tokens (§12.4), enums move into the shared contracts package |
| `src/config/brand.ts` | `BrandConfig` + `brand` (companyName, productName, tagline, trackingPrefix, supportEmail, theme colours) | **Becomes the tenant record** (§6.3) with this shape preserved as the override format |
| `src/store/AppContext.tsx` | 380-line monolith: all state, all mutations, auth, derived selectors | **Replace** with server state (contracts + fetch/mutation hooks) + a tiny UI store (§5.2) |
| `src/data/mock.ts` | 267 lines of seeded demo data | **Replace** with `db/seed.ts` producing the same demo world (§9.3) |
| `src/pages/*.tsx` | 9 pages, ~1,900 lines of JSX + inline styles | **Rebuild** per §14 |
| `src/components/*` | `AppLayout`, `guards`, `Highlight`, `Modal`, `NotificationPanel`, `StatCard`, `StatusBadge` | **Rebuild** with Spectrum UI equivalents (§3.4) |
| `src/utils/format.ts`, `src/utils/csv.ts` | Formatters and CSV export | **Keep**, move to `packages/shared` |

### 2.4 v1 behaviour to preserve exactly

- Shipment status chain and order: `pickup → warehouse → in_transit → delivered`, with `delayed` reachable from any point.
- `delayed` requires a `delayReason` (v1 types enforce it in `Checkpoint`). Keep the constraint, enforce it in the DB and the API.
- Every checkpoint records who logged it (`byUserId`, `byUserName`) and when. In v2 this is derived from the session, never sent by the client.
- Delay reasons vocabulary: Traffic congestion · Customs / documentation hold · Carrier issue · Weather conditions · Vehicle breakdown · Consignee unavailable · Other.
- Lead pipeline: `new → contacted → negotiation → won / lost`, with a free-text activity feed per lead and a `nextFollowUp` date.
- Invoice statuses: `paid`, `pending`, `overdue`. Invoice links to one or more shipments (`shipmentIds`).
- Carriers vocabulary: DHL · Safexpress · OM Logistics · DTDC · BlueDart · Gati · Other.
- Lead sources: Referral · Website · Cold outreach · Trade show · LinkedIn · Existing client.
- Notifications are typed `delay` | `milestone` and carry a shipment reference.
- The public tracking page shows a timeline of checkpoints with locations, and never requires login.

### 2.5 What v2 deliberately drops

- The mock-auth behaviour of accepting any password.
- `Highlight` (a text-match highlighter used only because search was client-side); server-side search replaces it.
- Client-side-only search. Search is a server query with the same UX (§11.5).

---

## 3. Design system — Spectrum UI (mandatory)

### 3.1 What it is

[Spectrum UI](https://github.com/arihantcodes/spectrum-ui) (homepage: `https://ui.spectrumhq.in`, docs: `https://ui.spectrumhq.in/docs`) is a free, Apache-2.0-licensed component collection built on **shadcn/ui + Tailwind CSS + Motion**. Its registry holds **272 items** (components, blocks, hooks, chart primitives). Every item is *copied into this repository* — there is no runtime dependency on Spectrum, no lock-in, and every file is ours to edit afterwards.

That last property is the reason it is the right choice here: the source lands in `components/spectrumui/`, the backend engineer and the designer both own it, and no vendor can break the build.

### 3.2 Non-negotiable rules

1. **Spectrum UI first.** For every UI concern, check the registry before writing markup. If Spectrum ships it, do not hand-roll it.
2. **Never edit a file in `components/spectrumui/` to make a one-off page work.** These files are the shared design-system layer. Extend via props, wrap in `components/app/*`, or fork the file to a new name if a genuine variant is needed — and note the fork in `docs/DESIGN-NOTES.md`.
3. **shadcn/ui primitives are allowed underneath** (Spectrum is built on them), but never as the user-facing surface when a Spectrum equivalent exists.
4. **No bespoke primitives.** No new `Modal.tsx`, `StatusBadge.tsx`, `Card.tsx`. v1's hand-rolled set is the anti-pattern this rule exists to prevent.
5. **Motion is part of the specification, not decoration.** Spectrum's Data Table ships house springs (`SPRING_FLUID` stiffness 300/damping 30, `SPRING_SNAPPY` 500/28, press feedback `active:scale-[0.96]`). Reuse its presets; do not invent new easings.
6. **Every Spectrum component must be verified in both themes** before its screen is considered done.
7. **Reduced motion is respected.** When `prefers-reduced-motion: reduce`, pass `animate={false}` to the Data Table and disable non-essential transitions (§13.6).

### 3.3 Installation

Registry consumption uses the shadcn CLI. The project must be initialised for shadcn first (`components.json` with `@spectrumui` registered as a registry), then:

```bash
# Required core
npx shadcn@latest add @spectrumui/data-table @spectrumui/audit-log-table
npx shadcn@latest add @spectrumui/status-badge @spectrumui/status-tracker
npx shadcn@latest add @spectrumui/stat-cards @spectrumui/animated-drawer

# Supporting surfaces (add as each screen is built, not in advance)
npx shadcn@latest add @spectrumui/chart-kit @spectrumui/bar-chart @spectrumui/line-chart
npx shadcn@latest add @spectrumui/area-chart @spectrumui/pie-chart @spectrumui/sparkline-chart
npx shadcn@latest add @spectrumui/command-palette @spectrumui/command-search
npx shadcn@latest add @spectrumui/multiple-selector @spectrumui/floating-label-input
npx shadcn@latest add @spectrumui/datetime-picker @spectrumui/autosize-textarea
npx shadcn@latest add @spectrumui/kanbanboard @spectrumui/login-card
npx shadcn@latest add @spectrumui/profile-dropdown @spectrumui/avatar-stack
npx shadcn@latest add @spectrumui/skeleton @spectrumui/skeleton-card @spectrumui/loading-state
npx shadcn@latest add @spectrumui/error-state @spectrumui/text-states
npx shadcn@latest add @spectrumui/toast-stack @spectrumui/inline-edit
npx shadcn@latest add @spectrumui/progress-with-value @spectrumui/quantity-stepper
npx shadcn@latest add @spectrumui/tab-navbar @spectrumui/sidebar-navbar @spectrumui/floating-navbar
npx shadcn@latest add @spectrumui/tree-nav @spectrumui/accordion @spectrumui/task-checkbox
npx shadcn@latest add @spectrumui/calendar-heatmap @spectrumui/insight-cards
```

An editor-integrated alternative exists and may be used instead of the CLI:

```bash
claude mcp add spectrum-ui -- npx -y @spectrumui/mcp
```

**Verified dependency facts** (do not deviate):

| Registry item | Type | Requires |
|---|---|---|
| `data-table` | component | npm `motion`; ships `data-table.tsx` |
| `audit-log-table` | block | registry `@spectrumui/data-table`; file `audit-log-table.tsx` |
| `status-tracker` | block | npm `lucide-react` |
| `status-badge` | component | npm `lucide-react` |
| `stat-cards` | component | ships `chart-engine.tsx` + `stat-cards.tsx` |
| `animated-drawer` | component | npm `lucide-react`, `motion`, `vaul`, `react-use-measure` |
| `use-surface-theme` | **hook** | none — exports `useSurfaceTheme` |

Note: `ThemeProvider` and `ThemeToggle` are **not** registry items. Port the two patterns (§12.1–12.2) by hand; they are short and they belong to this project.

### 3.4 Component mapping — v1 → v2

Every v1 UI concern has a Spectrum UI owner. Build nothing that is not in this table without updating the table.

| v1 surface | v2 component |
|---|---|
| hand-written `<table>` in Shipments / Invoices / Leads / Dashboard | `@spectrumui/data-table` (§11) |
| (nothing — v1 has no audit log) | `@spectrumui/data-table` + the `audit-log-table` block (§11.7) |
| `StatusBadge.tsx` + `*_STATUS_META` colour maps | `@spectrumui/status-badge` reading status → token pairs (§12.4) |
| checkpoint timeline in `ShipmentDetailPage` | `@spectrumui/status-tracker` (block) |
| `StatCard.tsx` + dashboard KPI grid | `@spectrumui/stat-cards` + `@spectrumui/insight-cards` |
| `ShipmentStats.tsx` (recharts) | `@spectrumui/chart-kit` with `bar-chart`, `line-chart`, `area-chart`, `pie-chart`, `sparkline-chart` |
| `Modal.tsx` | shadcn `Dialog` on desktop; `@spectrumui/animated-drawer` (vaul) on mobile (§13.3) |
| `NotificationPanel.tsx` | `@spectrumui/animated-drawer` + `@spectrumui/toast-stack` for transient events |
| global search field in the topbar | `@spectrumui/command-palette` / `@spectrumui/command-search` (⌘K) |
| `LoginPage` form | `@spectrumui/login-card` + `@spectrumui/floating-label-input` |
| carrier / client / assignee pickers | `@spectrumui/multiple-selector` (async search variant) |
| date fields (`expectedDelivery`, `nextFollowUp`, invoice `dueDate`) | `@spectrumui/datetime-picker` |
| notes / description textareas | `@spectrumui/autosize-textarea` |
| sidebar nav + topbar | `@spectrumui/sidebar-navbar` desktop, `@spectrumui/tab-navbar` mobile (§13.2) |
| user menu / avatar | `@spectrumui/profile-dropdown`, `@spectrumui/avatar-stack` for assignees |
| loading placeholders (none in v1) | `@spectrumui/skeleton`, `@spectrumui/skeleton-card`, `@spectrumui/loading-state` |
| empty lists (none in v1) | `@spectrumui/error-state`, `@spectrumui/text-states` |
| inline edits in Settings | `@spectrumui/inline-edit` |
| packages / weight steppers | `@spectrumui/quantity-stepper` |
| shipment progress indicator | `@spectrumui/progress-with-value` |
| lead pipeline (v1 used a table) | `@spectrumui/kanbanboard` on desktop, stacked cards on mobile (§14.5) |
| team management table (v1: settings tab) | `@spectrumui/team-members-table` block (structural reference) |
| invoice list | `@spectrumui/data-table`; take column ideas from the `invoices-table` block |
| settings sections | `@spectrumui/accordion` + `@spectrumui/tree-nav` |
| per-shipment activity / SLA check | `@spectrumui/calendar-heatmap` (delay heatmap by day) |

### 3.5 Design intent (the designer's standing preferences — apply throughout)

- **Accent is sky blue.** Never green as an accent. Green is reserved for the `delivered` / `paid` / `won` state only.
- **Amounts are headlines, not status cards.** An invoice row leads with the amount; status is secondary metadata.
- **Cards over tables for browsing lists** (leads, invoices) on mobile; a table is the correct choice only where comparison across many rows is the job (shipments, audit log, team).
- **One-click flows.** Creating a shipment, logging a status, revealing a tracking ID, exporting — each is a single decisive action with no confirmation dialog unless the action is destructive.
- **Apple-grade cohesion.** Every sibling page uses the same header rhythm, the same empty state, the same loading skeleton, the same table toolbar. "Make it consistent" means *every* page, not the one in the screenshot.
- **Micro-interactions everywhere.** Row hover, disclosure, sort caret, save confirmation, theme switch, drawer spring — all animated with Spectrum's presets. Never a layout jump.
- **Inter** for UI text, **JetBrains Mono** (or the Spectrum default mono) for tracking IDs, IPs, action keys, invoice numbers.
- **Tokens only.** No hex value in a component. Colour comes from a CSS variable (§12.4).

---

## 4. Technology decisions

### 4.1 Decision summary

| Layer | Decision | Why this and not the alternative |
|---|---|---|
| Runtime | Node.js 22 LTS | Matches what a full-stack hire is expected to know. |
| Package manager | **pnpm** workspaces | Fast, strict, one lockfile for the monorepo. |
| Frontend | **Next.js 15 App Router**, React 19, TypeScript (strict) | Spectrum UI is itself a Next.js App Router project; its components assume React Server/Client boundaries. Gives the backend engineer route handlers in the same deploy. |
| Styling | **Tailwind CSS v4** + shadcn/ui + Spectrum UI registry | Spectrum's token layer is Tailwind v4 `@theme inline` (§12.4). |
| Motion | `motion` (Motion for React) | Hard requirement of the Data Table. |
| Database | **SQLite via Drizzle ORM** locally → **PostgreSQL** in production | See §4.2. |
| Migrations | `drizzle-kit` | SQL files in `packages/db/migrations`, reviewable by hand. |
| Auth | **Auth.js v5 (NextAuth)** — Credentials provider + database sessions | See §4.3. |
| Contracts | **Zod** in a shared package, exported as OpenAPI | See §4.4. |
| API | Next.js Route Handlers (`app/api/**`), REST + JSON | See §4.5. |
| Client data | TanStack Query over the typed `api` client | Caching, optimistic updates, retries — without owning server state in a context. |
| Mock layer | **MSW** handlers generated from the same contracts | Lets the whole product be designed and shipped before the backend exists. |
| Testing | Vitest (unit, contracts, permissions) + Playwright (flows) | Vitest is the shadcn/Next default; Playwright covers mobile viewport and theme switching. |
| Charts | Spectrum chart kit (built on the same primitives as recharts) | Same visual language as the rest of the system. |

### 4.2 Database — the local-first call

**Local development: SQLite** (file at `./data/dev.db`, accessed through Drizzle with `better-sqlite3`).
**Production: PostgreSQL** (Neon / Supabase / Railway — interchangeable).

Rationale, in the order it matters for handover:

1. **Zero-install local start.** The client's engineer clones, runs `pnpm install && pnpm db:setup && pnpm dev`, and has a populated database in under two minutes. No Docker, no cloud account, no connection string, no "it works on my machine".
2. **One schema, two dialects.** Tables are declared once in `packages/db/schema/*.ts`. `drizzle.config.ts` reads `DATABASE_DIALECT` and the repositories are dialect-agnostic, so production is a config change plus a migration run — not a rewrite.
3. **SQL-first and explicit.** Drizzle emits reviewable SQL. A new engineer reads `migrations/*.sql` and understands the schema without learning an ORM's magic. This is the single most valuable property for a takeover.
4. **Portability of data.** `data/dev.db` is one file — trivially copied, backed up, or handed over inside the repo zip.

**Schema rules for SQLite↔Postgres compatibility** (follow these or the port breaks):

- IDs: `text` primary keys holding a `cuid2`. No auto-increment sequences as primary keys.
- Timestamps: `integer` holding Unix milliseconds, UTC. Never rely on a database `now()` default — set them in the repository layer. Render in IST at the edge (§12.7).
- Enums: `text` columns with a TypeScript union + Zod enum. Never a native database enum type.
- Money: `integer` in **paise**. No floats, ever.
- Booleans: `integer` 0/1 in SQLite, `boolean` in Postgres — handled by a Drizzle helper, not by hand.
- JSON: a `text` column holding JSON, parsed by Zod at the boundary. No dialect-specific JSONB operators in queries.
- Foreign keys and indexes declared in the schema so both dialects receive them.

### 4.3 Auth

**Auth.js v5, Credentials provider, database sessions, argon2id password hashes.**

- Sessions live in a `sessions` table (not JWT) so an admin can revoke access, and so "who is logged in right now" is queryable — which the audit log and the team screen both need.
- `role` and `tenant_id` are attached to the session and to every request context.
- OAuth (Google) is a later addition behind the same `accounts` table — the schema accommodates it now so nobody migrates later.
- `/track` is **outside** the auth boundary entirely (§8.5).

### 4.4 Contracts and the mock layer

`packages/contracts` owns every request/response shape as a Zod schema, plus the derived TypeScript types. It is consumed by:

1. Route handlers — validate input at the edge (`schema.parse`), and responses are typed against the same schema.
2. The browser client — `api.shipments.list({ status: 'delayed' })` is fully typed, no `any`.
3. **MSW mock handlers** — generated from the same schemas and seeded with the same demo data as the database. `NEXT_PUBLIC_API_MODE=mock` gives a fully interactive product with no server.
4. **OpenAPI export** — `pnpm contracts:openapi` writes `docs/openapi.json`.

This is the mechanism that satisfies "I want to ship this whole product with the frontend": the designer builds every screen, every state, every interaction against the mock layer, and the backend engineer later flips one env variable.

### 4.5 API surface decisions

- REST over JSON at `/api/v1/**`. Chosen over tRPC deliberately: the contract stays language-agnostic, so a future rewrite in NestJS/Go is a client change, not a client rewrite, and a non-TypeScript contractor can work against `docs/openapi.json`.
- Every list endpoint accepts the same query shape — this is what makes the tables swappable (§11.5):

```
?q=<full-text>&status=delayed&carrier=DTDC&assignedTo=<userId>
&from=<iso>&to=<iso>&sort=createdAt&dir=desc&page=1&pageSize=25
```

- Response envelope for lists:

```json
{ "data": [ ... ], "page": 1, "pageSize": 25, "total": 148, "totalPages": 6 }
```

- Errors use one shape everywhere:

```json
{ "error": { "code": "SHIPMENT_NOT_FOUND", "message": "…", "fieldErrors": { "carrierId": "Unknown carrier" }, "requestId": "req_…" } }
```

- Idempotency: every mutating endpoint accepts `Idempotency-Key`; the server stores the key + response for 24h. Carrier webhooks require it.
- `X-Request-Id` is echoed on every response and written into the audit row.

---

## 5. Repository structure

```
logiflow-v2/
├─ apps/
│  └─ web/                          # Next.js 15 — the only deployable app
│     ├─ app/
│     │  ├─ (auth)/login/page.tsx
│     │  ├─ (app)/                  # authenticated shell: sidebar + topbar
│     │  │  ├─ layout.tsx
│     │  │  ├─ page.tsx             # dashboard
│     │  │  ├─ shipments/page.tsx
│     │  │  ├─ shipments/[id]/page.tsx
│     │  │  ├─ leads/page.tsx
│     │  │  ├─ invoices/page.tsx
│     │  │  ├─ audit/page.tsx       # NEW — audit log
│     │  │  ├─ team/page.tsx
│     │  │  └─ settings/page.tsx
│     │  ├─ track/[trackingId]/page.tsx   # public, no auth
│     │  └─ api/v1/**               # route handlers
│     ├─ components/
│     │  ├─ spectrumui/             # registry output — treated as vendored
│     │  └─ app/                    # our compositions: ShipmentTable, ShipmentForm…
│     ├─ hooks/
│     ├─ lib/                       # api client, theme, formatters, csv
│     ├─ msw/                       # handlers + browser worker
│     └─ messages/                  # en/ + hi/ (i18n, §17.3)
├─ packages/
│  ├─ contracts/                    # Zod schemas + types + openapi export
│  ├─ db/                           # drizzle schema, migrations, seed, repositories
│  └─ shared/                       # tracking-id, masking, money, dates, rbac keys
├─ docs/
│  ├─ PRD.md                        # this document
│  ├─ API.md                        # generated
│  ├─ openapi.json                  # generated
│  ├─ DESIGN-NOTES.md               # token map, component forks
│  └─ adr/                          # one file per non-obvious decision
├─ data/dev.db                      # gitignored
├─ .env.example                     # placeholders only
└─ package.json                     # pnpm workspace root
```

### 5.1 Where things live (rules the backend engineer will thank you for)

- `packages/contracts` contains **no** database code and **no** React. It can be published as a package tomorrow.
- `packages/db/repositories/*` is the only place that talks to the ORM. Every method takes a `tenantId` and an optional `actor`. Route handlers never build queries.
- `packages/shared` holds pure functions: `generateTrackingId`, `maskTrackingId`, `formatMoney`, `formatDateIst`, plus the permission keys. Fully unit-tested, no dependencies.
- `apps/web/components/app/*` is where design decisions live. `components/spectrumui/*` is where the design system lives. Never mix.

### 5.2 Client state

Server state: TanStack Query with a typed `api` client. Query keys are `['shipments', filters, page]` etc.
UI state: a single small Zustand store — sidebar collapsed, active drawer, command palette open, selected theme (mirrored from `next-themes`). Nothing else. **No global context holding domain objects** — that is v1's mistake (§1.1 #1).

---

## 6. Domain model

### 6.1 Entities

**Tenant** — one row per logistics company using the platform (white-label root).

| Field | Type | Notes |
|---|---|---|
| `id` | text (cuid2) | |
| `slug` | text unique | used in URLs and as the tracking prefix source |
| `company_name` | text | e.g. "Five Logistics" |
| `product_name` | text | e.g. "LogiFlow" |
| `tagline` | text | |
| `tracking_prefix` | text | e.g. `5LX` — 2–5 uppercase alphanumerics |
| `support_email` | text | |
| `theme_primary`, `theme_primary_dark`, `theme_accent`, `theme_sidebar_bg` | text | hex; consumed by the theme layer, overridable per tenant |
| `timezone` | text | default `Asia/Kolkata` |
| `currency` | text | default `INR` |
| `plan` | text | `trial` \| `standard` \| `enterprise` |
| `created_at` | integer | |

**User**

`id`, `tenant_id`, `name`, `email` (unique per tenant), `phone?`, `role` (§7), `avatar_url?`, `password_hash`, `active` (bool), `last_login_at?`, `invited_by?`, `created_at`.

**Client** (the logistics company's customer — v1 carried `client` as a plain string on every shipment)

`id`, `tenant_id`, `name`, `contact_name?`, `email?`, `phone?`, `gstin?`, `address_line1?`, `address_line2?`, `city?`, `state?`, `pincode?`, `credit_terms_days?`, `active`, `created_at`. Unique on `(tenant_id, name)`.

> v1 stored `client` as free text on the shipment. v2 promotes it to a real entity but the API accepts a plain string and resolves-or-creates it, so no UI flow depends on the client existing first.

**Carrier**

`id`, `tenant_id`, `code` (`DTDC`, `DHL`, `SAFEXPRESS`, `OM`, `BLUEDART`, `GATI`, `OTHER`), `name`, `adapter` (which `CarrierAdapter` implementation to use, `mock` by default), `tracking_url_template?`, `webhook_secret_ref?`, `supports_webhook` (bool), `active`, `priority`, `created_at`.

**Shipment** — the centre of the product.

| Field | Type | Notes |
|---|---|---|
| `id` | text (cuid2) | |
| `tenant_id` | text | |
| `tracking_id` | text | **ours**, e.g. `5LX-DT58K7`. Unique per tenant. Immutable once issued. |
| `carrier_id` | text FK | |
| `carrier_tracking_id` | text? | **the carrier's own ID** (AWB / docket number). Set on booking, or entered manually. Masked in the UI (§8). |
| `carrier_tracking_id_set_at` | integer? | |
| `client_id` | text FK | resolved from the free-text client name |
| `reference_number` | text? | customer PO / docket reference |
| `origin` / `destination` | text | v1 stored city strings; v2 stores the string plus optional structured fields |
| `origin_pincode?`, `destination_pincode?` | text? | needed for carrier APIs and for ETA |
| `invoice_number` | text? | the client's commercial invoice for this consignment |
| `packages` | integer | ≥ 1 |
| `weight_kg` | integer (grams×1000) or decimal-as-int | store as integer grams to stay dialect-safe; display kg |
| `declared_value_paise` | integer? | |
| `service_level` | text | `surface` \| `air` \| `express` |
| `payment_mode` | text | `prepaid` \| `cod` \| `to_pay` |
| `status` | text | `pickup` \| `warehouse` \| `in_transit` \| `delivered` \| `delayed` |
| `assigned_to` | text FK → user | operations owner |
| `created_by` | text FK → user | |
| `created_at`, `updated_at` | integer | |
| `expected_delivery` | integer | |
| `delivered_at` | integer? | set when status becomes `delivered` |
| `delay_reason` | text? | **required when `status = 'delayed'`** |
| `notes` | text? | |
| `last_synced_at` | integer? | last carrier poll |
| `sync_state` | text | `manual` \| `synced` \| `stale` \| `error` |

**Checkpoint** — the shipment timeline (v1's model, preserved)

`id`, `shipment_id`, `status`, `label`, `location?`, `note?`, `delay_reason?` (required when `status = 'delayed'`), `occurred_at` (client-assertable, defaults to now), `recorded_at` (server-set, immutable), `source` (`manual` \| `carrier_webhook` \| `carrier_poll` \| `system`), `by_user_id?` (null for automated), `by_user_name?`, `raw_payload?` (JSON text for carrier events).

**Lead** — v1 model preserved, plus conversion linkage.

`id`, `tenant_id`, `name`, `company`, `email`, `phone`, `source` (the six-value vocabulary), `status` (`new` \| `contacted` \| `negotiation` \| `won` \| `lost`), `assigned_to`, `notes`, `next_follow_up` (integer?), `expected_value_paise?`, `converted_client_id?`, `created_at`, `updated_at`.
**LeadActivity**: `id`, `lead_id`, `kind` (`note` \| `call` \| `email` \| `status_change`), `text`, `by_user_id`, `created_at`.

**Invoice**

`id`, `tenant_id`, `number` (human, e.g. `INV-2026-0042`, from a `sequences` table), `client_id`, `status` (`paid` \| `pending` \| `overdue`), `subtotal_paise`, `tax_paise`, `total_paise`, `currency`, `issue_date`, `due_date`, `paid_at?`, `notes?`, `created_at`, `updated_at`.
**InvoiceLine**: `id`, `invoice_id`, `shipment_id?`, `description`, `amount_paise`, `tax_rate_bp` (basis points).
**Invoice↔Shipment**: many-to-many through `invoice_lines.shipment_id` — this replaces v1's `shipmentIds: string[]`.

**Notification**

`id`, `tenant_id`, `user_id?` (null = broadcast to tenant), `type` (`delay` \| `milestone` \| `invoice` \| `assignment` \| `system`), `title`, `message`, `shipment_id?`, `invoice_id?`, `read_at?`, `created_at`, `channels_sent` (JSON text: `["inapp","email"]`).

**AuditEvent** — append-only, see §11.7.

`id`, `tenant_id`, `occurred_at`, `actor_type` (`user` \| `system` \| `carrier` \| `api_key`), `actor_id?`, `actor_name`, `actor_avatar_url?`, `action` (dot-namespaced key, e.g. `shipment.status_changed`), `entity_type`, `entity_id`, `entity_label` (human string, denormalised so the table renders without joins), `severity` (`info` \| `warn` \| `error`), `summary` (one line), `changes` (JSON text: `{ field: { from, to } }`), `ip`, `user_agent`, `request_id`, `source` (`web` \| `api` \| `webhook` \| `job`).

**Session**, **Attachment**, **Job**, **Sequence** — supporting tables (`sessions` for auth; `attachments` = `id, tenant_id, entity_type, entity_id, filename, mime, size, storage_key, uploaded_by, created_at`; `jobs` = queued work with `type, payload, run_at, attempts, last_error, status`; `sequences` = per-tenant per-year counters for invoice numbers).

### 6.2 Enums — single source of truth

All enums live in `packages/contracts/src/enums.ts` as `as const` arrays, and are re-used by the schema, the Zod validators, the forms, the CSV exporter and the filters UI. Never duplicate an enum as a literal union in a component.

### 6.3 Tenant / white-label configuration

`brand.ts` (v1) becomes a row plus an optional file override:

```ts
// packages/shared/src/brand.ts
export interface BrandConfig {
  companyName: string;        // "Five Logistics"
  productName: string;        // "LogiFlow"
  tagline: string;
  trackingPrefix: string;     // "5LX"
  supportEmail: string;
  theme: { primary: string; primaryDark: string; accent: string; sidebarBg: string };
}
```

Resolution order: env override (`NEXT_PUBLIC_BRAND_*`, local development) → tenant row → defaults. **No component may read `brand` directly**; it comes from `useBrand()` (client) or the tenant loader (server). This keeps the v1 promise ("to resell the platform to another logistics company, swap only this config") while moving the swap from a rebuild to a database row.

---

## 7. Roles and permissions

### 7.1 Roles

v1 had two roles. v2 keeps both — under their v1 semantics — and adds the five that the pilot client already works around with shared logins.

| Role key | Label | v1 equivalent | Scope |
|---|---|---|---|
| `owner` | Owner | `owner` | Tenant-wide, including billing and tenant settings. At least one must always exist. |
| `admin` | Admin | `owner` minus billing | Everything except plan/billing and tenant deletion. |
| `ops_manager` | Operations Manager | — | All shipments, all clients, carrier config, audit log read, reports. |
| `dispatcher` | Dispatcher | `team_member` | **Assigned shipments and leads only**, can log status. |
| `accounts` | Accounts | — | Invoices, clients, payment status. Sees shipments read-only. |
| `sales` | Sales | — | Leads and clients only; sees the shipments of their clients read-only. |
| `viewer` | Viewer | — | Read-only, assigned scope. For auditors and clients' staff. |

Role migration for existing data: `owner` → `owner`; `team_member` → `dispatcher`.

### 7.2 Permission keys

Replace v1's six booleans with named keys. The UI and the API talk about the same strings.

| Key | owner | admin | ops_manager | dispatcher | accounts | sales | viewer |
|---|---|---|---|---|---|---|---|
| `shipment:create` | ✅ | ✅ | ✅ | ✅ | | | |
| `shipment:read_all` | ✅ | ✅ | ✅ | | ✅ | ✅ (own clients) | |
| `shipment:read_assigned` | ✅ | ✅ | ✅ | ✅ | | | ✅ |
| `shipment:update` | ✅ | ✅ | ✅ | ✅ (assigned) | | | |
| `shipment:log_status` | ✅ | ✅ | ✅ | ✅ (assigned) | | | |
| `shipment:delete` | ✅ | ✅ | | | | | |
| `shipment:assign` | ✅ | ✅ | ✅ | | | | |
| `tracking:reveal` | ✅ | ✅ | ✅ | | | | |
| `carrier:manage` | ✅ | ✅ | ✅ | | | | |
| `client:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| `client:manage` | ✅ | ✅ | ✅ | | ✅ | ✅ | |
| `invoice:read` | ✅ | ✅ | | | ✅ | | |
| `invoice:manage` | ✅ | ✅ | | | ✅ | | |
| `lead:read_all` | ✅ | ✅ | ✅ | | | ✅ | |
| `lead:read_assigned` | ✅ | ✅ | ✅ | ✅ | | ✅ | ✅ |
| `lead:manage` | ✅ | ✅ | ✅ | ✅ (assigned) | | ✅ (assigned) | |
| `analytics:view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| `audit:read` | ✅ | ✅ | ✅ | | | | ✅ |
| `audit:export` | ✅ | ✅ | ✅ | | | | |
| `team:manage` | ✅ | ✅ | | | | | |
| `settings:manage` | ✅ | ✅ | | | | | |
| `billing:manage` | ✅ | | | | | | |

Kept from v1 verbatim in meaning: `canLogStatus` → `shipment:log_status`; `canViewInvoices` → `invoice:read`; `canManageTeam` → `team:manage`; `canViewAllShipments` → `shipment:read_all`; `canViewAllLeads` → `lead:read_all`; `canViewAnalytics` → `analytics:view`.

### 7.3 Enforcement — one choke point

- **Server (authoritative).** Every route handler is wrapped: `withAuth(handler, { permission: 'shipment:update', scope: 'assigned' })`. The wrapper resolves the session, resolves the permission, applies row scoping (`assigned_to = me` when `scope: 'assigned'` and the actor lacks `read_all`), and writes the audit row. Route handlers never check roles themselves.
- **Client (cosmetic only).** `usePermission()` hides navigation and disables controls. This is a convenience, never a security boundary — document that in a comment so nobody "optimises" the server check away.
- **Navigation** is derived, exactly as v1 did: an item appears only if its permission is held. `/invoices` is hidden from dispatchers, `/audit` only from those with `audit:read`.

---

## 8. Tracking IDs — ours, theirs, and the mask

This is the part of the product that v1 got wrong (one string, no separation, no masking), and it is where the pilot client's real workflow lives.

### 8.1 Two identifiers, never interchangeable

| | Internal tracking ID | Carrier tracking ID |
|---|---|---|
| Who issues it | LogiFlow, at shipment creation | The carrier (or the carrier's API on booking) |
| Example | `5LX-DT58K7` | `D1928374650` (DTDC), `1234567890` (BlueDart) |
| Format | `{TENANT_PREFIX}-{6 chars, Crockford base32, no I/L/O/U}` | Free text, carrier-defined, 6–24 chars, often numeric |
| Who sees it | Customer, support, operators | Operators with `tracking:reveal`, and the carrier |
| Masked? | Yes, unless the viewer has `tracking:reveal` | **Always** masked unless the viewer has `tracking:reveal` |
| Tracked publicly | Yes — `/track/{trackingId}` | No |
| Unique | Per tenant, immutable | Per carrier-tenant pair |

The internal ID is what the customer quotes on the phone. The carrier ID is an operational detail. Conflating them is what made v1's tracking page leak the carrier's docket to anyone with a link.

### 8.2 Generation

```ts
// packages/shared/src/tracking.ts
export function generateTrackingId(prefix: string): string   // "5LX-DT58K7"
export function parseTrackingId(id: string): { prefix: string; body: string } | null
export function isPlausibleTrackingId(id: string): boolean
```

- Alphabet excludes look-alikes (`I`, `L`, `O`, `U`, `0`, `1`).
- Length 6 for the body. Collision-checked against the tenant's rows, retried up to 5 times.
- Prefix is uppercased; the body is uppercased. Comparison is case-insensitive and ignores spaces/dashes typed by a human.
- `generateTrackingId` is unit-tested for uniqueness over 100k iterations.

### 8.3 Masking

```ts
export type MaskPolicy = 'last2' | 'first2_last2' | 'full' | 'none';
export function maskTrackingId(id: string, policy?: MaskPolicy): string
```

| Policy | `5LX-DT58K7` becomes | Used where |
|---|---|---|
| `last2` (**default for internal IDs**) | `5LX-••••K7` | Shipment lists, dashboards, customer emails |
| `first2_last2` (**default for carrier IDs**) | `5LX-DT••••K7` / `D9••••50` | Detail pages for users who can edit but not reveal |
| `full` | `••••••••` | Activity feeds, notifications, logs, screenshots-by-default surfaces |
| `none` | `5LX-DT58K7` | Only behind `tracking:reveal` |

Non-negotiable rules:

1. **Masking is server-side.** The API returns the bare ID only when the caller holds `tracking:reveal`. Everywhere else it returns the *masked* value plus `masked: true`; the raw value never enters the payload, the DOM, or the network tab.
2. **Reveal is an audited event.** `POST /api/v1/shipments/:id/tracking/reveal` → returns the raw IDs, sets a short-lived reveal flag for that row in the client (in-memory, 30 seconds, then re-masks), and appends `tracking.revealed` to the audit log with actor, IP and entity.
3. **Copy is a separate audited action** when the value is unmasked: `tracking.copied`.
4. **Masked values are still copyable** — the copy button copies the raw value only if revealed; otherwise it copies the masked string and shows a toast explaining that reveal is required. No silent full-value copy.
5. **Never log raw IDs.** The pino redaction list includes `tracking_id`, `carrier_tracking_id`, `password`, `password_hash`, `authorization`, `cookie`.
6. **Public tracking** (`/track/{trackingId}`) returns the shipment's status, checkpoints, origin/destination and ETA, with **the internal ID echoed as entered** (the visitor already has it) and **the carrier ID masked with `first2_last2`**. Add rate limiting (10 requests/minute/IP) and a per-IP failure counter to stop enumeration. Do not return client name, phone, or value.
7. **Search** matches against both IDs server-side but returns only masked display values. Searching by a masked fragment matches nothing — the user must paste the full ID.

### 8.4 Carrier ID capture

Order of preference, all writing the same field:

1. **Booking through the adapter** — `adapter.createShipment()` returns the carrier's ID; set `carrier_tracking_id`, `carrier_tracking_id_set_at`, `sync_state = 'synced'`.
2. **Manual entry** on the shipment detail page (permission `shipment:update`) — `sync_state = 'manual'`.
3. **Webhook** from the carrier — matched by our ID or by a reference, sets `sync_state = 'synced'`.

A shipment with no carrier ID is valid (`carrier_tracking_id` nullable) — the pilot client books on the phone and enters the docket later. The shipments table shows `— not yet issued` in that state, and the row's quick-filter group includes *Awaiting carrier ID*.

### 8.5 Public tracking URL

Canonical: `/track/{trackingId}` (matches v1's `/track?id=` behaviour but is shareable and indexable per shipment). `/track?q=...` redirects to the canonical form. The v1 demo IDs (§2.2) must resolve against the seed data.

---

## 9. Backend specification

### 9.1 Route handlers

All under `/api/v1`. `🔒` = auth required, `👤` = permission-gated, `🌐` = public.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` 🌐 | Credentials login; issues a session cookie. Replaces v1 mock auth. |
| POST | `/auth/logout` 🔒 | |
| GET | `/auth/session` 🔒 | Current user, role, resolved permission list, tenant brand. |
| GET | `/auth/team` 👤 `team:manage` | Team list. |
| POST | `/auth/team/invite` 👤 `team:manage` | Creates an inactive user + invite token. |
| PATCH | `/auth/team/:id` 👤 `team:manage` | Change role, deactivate. Audited. |
| GET | `/shipments` 🔒 | List + filters + sort + pagination (§4.5). Returns masked tracking IDs. |
| POST | `/shipments` 👤 `shipment:create` | Issues the internal tracking ID; resolves-or-creates the client; writes `shipment.created`. |
| GET | `/shipments/:id` 🔒 | Detail incl. checkpoints, carrier, client, invoices, attachments. |
| PATCH | `/shipments/:id` 👤 `shipment:update` | Field-level diff captured into the audit row. |
| DELETE | `/shipments/:id` 👤 `shipment:delete` | Soft delete (`deleted_at`), audited. |
| POST | `/shipments/:id/checkpoints` 👤 `shipment:log_status` | Requires `delayReason` when `status = 'delayed'`. Recomputes `status`, `delivered_at`. Emits notifications. |
| GET | `/shipments/:id/checkpoints` 🔒 | Timeline. |
| POST | `/shipments/:id/tracking/reveal` 👤 `tracking:reveal` | §8.3. Audited. |
| POST | `/shipments/:id/carrier-booking` 👤 `shipment:update` | Calls the carrier adapter; stores the carrier ID. Audited. |
| POST | `/shipments/:id/sync` 👤 `shipment:update` | Force a carrier sync now. |
| GET | `/shipments/stats` 👤 `analytics:view` | Aggregates powering §14.4 and the dashboard. |
| GET | `/shipments/export` 👤 `analytics:view` | CSV, respects current filters. |
| GET | `/clients`, `POST /clients`, `PATCH /clients/:id` | Client CRUD. |
| GET | `/carriers`, `POST /carriers`, `PATCH /carriers/:id` | Carrier config incl. adapter selection. |
| GET | `/leads` 🔒 | Scoped by permission. |
| POST | `/leads` 👤 `lead:manage` | |
| PATCH | `/leads/:id` 👤 `lead:manage` | Status moves are audited. |
| POST | `/leads/:id/activity` 👤 `lead:manage` | Appends to the activity feed. |
| GET | `/invoices` 👤 `invoice:read` | |
| POST | `/invoices` 👤 `invoice:manage` | Number from `sequences`. |
| PATCH | `/invoices/:id` 👤 `invoice:manage` | Status/paid_at audited. |
| GET | `/invoices/export` 👤 `invoice:read` | CSV. |
| GET | `/audit` 👤 `audit:read` | Paged, filtered, sorted — feeds §11.7. |
| GET | `/audit/export` 👤 `audit:export` | CSV, streamed. |
| GET | `/audit/export.json` 👤 `audit:export` | JSON Lines, for compliance handoff. |
| GET | `/notifications` 🔒 | |
| POST | `/notifications/:id/read`, `/notifications/read-all` 🔒 | |
| GET | `/track/:trackingId` 🌐 | §8.5. Rate-limited. |
| POST | `/webhooks/carriers/:code` 🌐 | HMAC-verified, idempotent, writes checkpoints with `source = 'carrier_webhook'`. |
| GET | `/health` 🌐 | Liveness + DB check. |

### 9.2 Audit write path

One function, one place:

```ts
recordAudit(tx, {
  action: 'shipment.status_changed',
  entity: { type: 'shipment', id, label: shipment.trackingId },
  actor,
  changes: { status: { from: 'in_transit', to: 'delayed' } },
  summary: 'Status changed to Delayed — Customs / documentation hold',
  severity: 'warn',
  source: 'web',
  requestId,
});
```

Rules:

- Called **inside the same transaction** as the mutation. If the audit write fails, the mutation rolls back. There is no path that changes data without a log line.
- `audit_events` is append-only: a database trigger rejects `UPDATE` and `DELETE` on the table. Corrections are new rows, never edits.
- The action key namespace is closed and enumerated in `contracts/src/audit-actions.ts`: `shipment.*`, `checkpoint.*`, `tracking.*`, `client.*`, `carrier.*`, `lead.*`, `invoice.*`, `team.*`, `auth.*`, `settings.*`, `export.*`, `system.*`. Adding a key is a one-line change reviewed by a human.
- Severity guide: `info` = normal operation; `warn` = needs attention (delay logged, invoice overdue, carrier sync failed); `error` = failed or denied action (permission denied, webhook signature rejected, integration error).

### 9.3 Seed data — reproduce v1's demo world

`pnpm db:seed` creates:

- 1 tenant: Five Logistics / LogiFlow, prefix `5LX`, `Asia/Kolkata`, `INR`.
- 4 users from §2.2 with the v1 roles mapped to v2 roles, plus one `admin`, one `accounts`, one `sales`, one `viewer` so every permission path is demonstrable. Passwords come from `.env` (`SEED_PASSWORD`), never from the repository.
- 6 carriers from v1's vocabulary, with DTDC marked `supports_webhook`.
- ~24 clients, 60 shipments spread across all five statuses (including at least 4 delayed, each with a delay reason), 200+ checkpoints with realistic Indian city pairs, 18 leads across the pipeline, 12 invoices in all three states, ~40 notifications, and **~500 audit events** covering every action namespace so the audit table has a realistic density to be designed against.
- The four demo tracking IDs from §2.2 present and resolvable.

The seed is deterministic (fixed `SEED` for the pseudo-random generator) so two developers see the same data.

### 9.4 Carrier adapters

```ts
export interface CarrierAdapter {
  code: string;
  createShipment(input: CreateShipmentInput): Promise<{ carrierTrackingId: string; labelUrl?: string }>;
  getTracking(carrierTrackingId: string): Promise<NormalisedTracking>;
  normaliseEvent(raw: unknown): CheckpointInput | null;
  verifyWebhook(headers: Headers, rawBody: string): boolean;
  trackingUrl(carrierTrackingId: string): string | null;
}
```

- `MockCarrierAdapter` is the default and is what runs locally and in the demo. It returns deterministic fake data derived from the shipment's ID (same input → same output), so the UI never flickers between runs.
- Real adapters (`dtdc`, `delhivery`, `bluedart`, `shiprocket`, `indiapost`, `xpressbees`) ship as **typed stubs** that throw `NotImplemented` behind a feature flag, each with a `TODO` block listing what credentials and endpoints are needed. This is the honest handover: the interface and the wiring exist, the vendor integration is the next engineer's sprint.
- Status normalisation maps any carrier's vocabulary onto our five statuses plus a `raw_status` string kept on the checkpoint.

### 9.5 Background jobs

A `jobs` table plus a worker (`pnpm worker`, `tsx packages/db/src/worker.ts`) for local development; Vercel Cron in production. Job types:

| Job | Schedule | Does |
|---|---|---|
| `carrier_status_sync` | every 15 min | Polls adapters without webhooks for open shipments; writes checkpoints; sets `sync_state = 'stale'` after 3 failures. |
| `delayed_detection` | hourly | Flags shipments past `expected_delivery` without delivery → status `delayed`, reason `Carrier issue` pending operator correction, notification emitted. |
| `eta_recompute` | hourly | Recomputes `expected_delivery` from recent checkpoint velocity. |
| `invoice_overdue_sweep` | daily 09:00 IST | `pending` → `overdue` past `due_date`; audited; notifies accounts. |
| `notification_dispatch` | every minute | Sends queued email/in-app notifications through the channel adapters. |
| `lead_follow_up_reminder` | daily 08:00 IST | Notifies owners of leads with `next_follow_up` today. |
| `audit_retention` | monthly | Archives audit rows older than the tenant's retention window to cold storage. Never deletes within retention. |

Jobs are idempotent: each carries a natural key (`type` + entity + bucket) and a unique index prevents duplicates.

### 9.6 Notifications and email

- Channel adapters implement `NotificationChannel { send(n): Promise<Result> }` — `inapp` (DB row), `email` (Resend behind an interface, `ConsoleEmailAdapter` locally that writes `.eml` files to `./data/mail/`).
- Templates: shipment created, status changed, delayed, delivered, assigned to you, invoice due soon, invoice overdue, teammate invited, tracking revealed (security notice).
- User preferences per type per channel on the user record (`notification_prefs` JSON).

### 9.7 The mock layer (contract-first frontend)

- `apps/web/msw/handlers.ts` implements every route in §9.1 against the seed fixtures, using the same Zod schemas as the server.
- `NEXT_PUBLIC_API_MODE=mock` boots the app with the service worker installed and zero backend.
- Contract tests assert that the mock handlers and the real handlers both satisfy the same schemas — so a mock can never drift silently.
- Result: the designer can build, review and demo 100% of the product with `pnpm dev` on a machine with nothing installed but Node.

### 9.8 Security and correctness baseline

- Argon2id password hashing (parameters documented in `docs/adr/`), session cookies `httpOnly`, `secure`, `sameSite=lax`, 30-day rolling expiry, absolute 90-day cap.
- Zod validation on every request body, query and response. Unknown query params are rejected (`strict()`), which catches typos early.
- Tenant isolation: every repository method requires a `tenantId`; a lint rule bans raw ORM usage outside `packages/db/repositories`.
- Rate limits: `/auth/login` (5/min/IP, then exponential backoff), `/track` (10/min/IP), `/webhooks` (generous but signature-checked).
- CSV export escapes leading `=`, `+`, `-`, `@` (formula injection).
- Every mutation is audited; every export is audited; every reveal is audited.
- Secrets only in `.env`. `.env.example` ships placeholders (`DATABASE_URL=file:./data/dev.db`, `AUTH_SECRET=[REDACTED]`, `RESEND_API_KEY=[REDACTED]`, `DTDC_API_KEY=[REDACTED]`). No real value ever enters the repository or this document.

---

## 10. Frontend application shell

- **Desktop (≥1024px):** fixed sidebar (collapsible to icon rail, state persisted), topbar with command palette trigger, notification bell, theme toggle, profile dropdown. Content max-width 1440px with a 24px gutter.
- **Tablet (768–1023px):** sidebar collapses to the icon rail by default; tables drop their lower-priority columns via the Data Table's `hideBelow`.
- **Mobile (<768px):** no sidebar — `@spectrumui/tab-navbar` at the bottom with the four primary destinations (Dashboard, Shipments, Leads, More); "More" opens an `animated-drawer` holding Invoices, Audit, Team, Settings. Primary actions become a floating action button above the tab bar. The topbar keeps only the page title, search icon and theme toggle.
- **Public tracking page** has its own minimal shell (brand mark, tracking form, timeline, support contact) and shares the token layer and theme toggle.

---

## 11. The table engine and the audit log

### 11.1 One engine, every list

`@spectrumui/data-table` is the **only** table implementation in the app. Shipments, invoices, leads (desktop), team, clients, carriers and audit all render through it. No page may contain a raw `<table>` element.

### 11.2 The component's real API (verified from the registry source — use these props, do not invent others)

```ts
type DataTableVariant = 'default' | 'bordered' | 'striped' | 'minimal' | 'panel';
type DataTableDensity = 'compact' | 'default' | 'relaxed';
type DataTableAlign   = 'start' | 'center' | 'end';
type DataTableSortDirection = 'asc' | 'desc';
type DataTableValue = string | number | boolean | Date | null | undefined;

interface DataTableSort { columnId: string; direction: DataTableSortDirection }

interface DataTableColumn<T> {
  id: string;                                  // stable key; doubles as the row property when `value` is absent
  header: React.ReactNode;
  cell?: (row: T, index: number) => React.ReactNode;   // falls back to the value as text
  value?: (row: T) => DataTableValue;          // the comparable/searchable value behind rendered markup
  align?: DataTableAlign;
  width?: number | string;
  sortable?: boolean;
  numeric?: boolean;                           // end-aligns + tabular figures
  hideBelow?: 'sm' | 'md' | 'lg';              // drop the column instead of scrolling
  formatTotal?: (sum: number) => string;       // footer sum for this column
  className?: string;
  headerClassName?: string;
}

interface DataTableQuickFilter<T> {
  columnId: string;
  label?: string;                              // e.g. "Filter by status"
  getValue?: (row: T) => string;
  options?: { value: string; label?: React.ReactNode }[];  // defaults to distinct column values
  allLabel?: string;
}

interface DataTableProps<T> {
  data: readonly T[];
  columns: DataTableColumn<T>[];
  rowId: (row: T) => string;                   // selection + disclosure are keyed on it
  rowLabel?: (row: T) => string;               // screen-reader name for the row (defaults to first cell)

  variant?: DataTableVariant;
  density?: DataTableDensity;

  caption?: string;                            // screen-reader description, never painted
  title?: React.ReactNode;                     // toolbar heading
  toolbar?: React.ReactNode;                   // controls parked at the end of the toolbar

  searchable?: boolean;
  searchPlaceholder?: string;
  searchText?: (row: T) => string;             // override the search haystack
  quickFilter?: DataTableQuickFilter<T>;       // one-tap value pills with live counts

  defaultSort?: DataTableSort | null;
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;

  selectable?: boolean;
  defaultSelectedIds?: string[];
  selectedIds?: string[];
  onSelectedChange?: (ids: string[]) => void;
  bulkActions?: (ctx: { ids: string[]; rows: T[]; clear: () => void; remove: () => void }) => React.ReactNode;

  renderDetail?: (row: T) => React.ReactNode;  // one-at-a-time disclosure panel under a row
  rowActions?: (row: T, actions: { remove: () => void }) => React.ReactNode;   // trailing cell on hover/focus
  onDelete?: (ids: string[]) => void;          // fires after the removal animation; delete from your data here

  pageSize?: number;                           // omit to render every row
  loading?: boolean;
  skeletonRows?: number;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;

  keyboardNavigation?: boolean;                // arrow cursor, shift-range, ⌘A / ⌘C / Space; one Tab stop
  clipboard?: boolean;                         // selected rows → TSV on the clipboard
  totals?: string[];                           // column ids to sum in a footer that recounts as you filter
  resizableColumns?: boolean;                  // drag or arrow-key the header edge
  pinFirstColumn?: boolean;                    // keep leading cells in place while scrolling sideways
  stickyHeader?: boolean;                      // pair with maxHeight
  maxHeight?: number | string;                 // e.g. 360 or "60vh"
  animate?: boolean;                           // false drops reorder/disclosure/selection motion
  className?: string;
}
```

Motion presets the component ships with (reuse, do not invent): fluid reposition `spring(300, 30)`; snappy caret/chevron `spring(500, 28)`; icon swaps `spring(duration .3, bounce 0)`; bulk-bar entrance `spring(260, 20)`; press feedback `active:scale-[0.96]`; row exit `duration .18 easeOut`.

### 11.3 Per-page table configuration

| Page | variant | density | pageSize | selection | totals | Extras |
|---|---|---|---|---|---|---|
| Shipments | `default` | `default` | 25 | ✅ bulk assign / bulk status | — | `searchable`, `quickFilter` on status, `resizableColumns`, `keyboardNavigation`, `clipboard`, `stickyHeader`, `maxHeight: '70vh'`, `renderDetail` = checkpoint summary, `rowActions` = Log status / Reveal tracking |
| Invoices | `striped` | `default` | 25 | ✅ bulk export | `total_paise` | `numeric` on amount columns, `formatTotal` → ₹ formatting |
| Leads (desktop) | `default` | `relaxed` | 25 | — | — | `onRowClick` → drawer; kanban is the default view (§14.5) |
| Team | `minimal` | `compact` | — | ✅ deactivate | — | role column as a select |
| Clients | `minimal` | `default` | 25 | — | — | `onRowClick` → detail |
| Carriers | `minimal` | `compact` | — | — | — | adapter + webhook status |
| **Audit** | `bordered` | `compact` | see below | ✅ export selection | — | see §11.7 |

### 11.4 Server-side data, client-side interaction

Filters, sort and pagination are **server** queries (§4.5). The table receives `data`, `total` and `loading`, and reports changes upward:

```tsx
<DataTable
  data={page.data}
  columns={columns}
  rowId={(r) => r.id}
  loading={isFetching}
  pageSize={pageSize}
  defaultSort={{ columnId: 'created_at', direction: 'desc' }}
  onSortChange={({ columnId, direction }) => setParams({ sort: columnId, dir: direction, page: 1 })}
  searchable
  searchPlaceholder="Search tracking ID, client, carrier…"
  quickFilter={{ columnId: 'status', label: 'Filter by status' }}
  …
/>
```

Search is debounced at 300 ms and is **server-side**; the Data Table's own `searchable` is kept for the fast local case (audit's page window, team, carriers) and disabled where the dataset is server-paged. Document the choice per table in a comment — this prevents the classic bug of searching only the current page.

### 11.5 The list query contract (shared by every table)

`q`, `status`, `carrier`, `client`, `assignedTo`, `from`, `to`, `sort`, `dir`, `page`, `pageSize`. The Data Table's state maps onto these names 1:1, so a filter pill, a URL query param and an API parameter are the same word.

Filters are reflected in the URL (`?status=delayed&carrier=DTDC`) so any view is shareable and the back button works.

### 11.6 Empty, loading, error

- **Loading:** `loading` + `skeletonRows={8}` — real skeleton rows, never a centred spinner.
- **Empty (no data at all):** `emptyState` with an illustration from `@spectrumui/error-state`, one sentence, and the primary action ("Create your first shipment").
- **Empty (filters returned nothing):** a distinct state — "No shipments match these filters" + a Clear filters action. These are different states and must look different.
- **Error:** inline banner above the table with a retry, keeping the last good rows visible; never blank the table on a transient failure.

### 11.7 The Audit Log Table

**The audit log is the flagship table of this product and uses Spectrum UI's Data Table in its `bordered` + `compact` configuration, in the pattern of the registry's `audit-log-table` block.** Install both:

```bash
npx shadcn@latest add @spectrumui/audit-log-table   # pulls @spectrumui/data-table as a dependency
```

**Reality check for the implementer:** the registry block ships a *demo* `AuditLogTable({ variant: 'Pinned' | 'Paged' })` component with 28 hardcoded rows and columns `time · actor · action · target · ip · level`. Use it as the visual and interaction reference, then write `components/app/AuditLogTable.tsx` against the real `AuditEvent` contract (§6.1) and the real endpoint `GET /api/v1/audit`. Do not ship the demo data.

**Column specification**

| # | id | header | width | sortable | hideBelow | cell |
|---|---|---|---|---|---|---|
| 1 | `occurred_at` | Time | 92 | ✅ | — | `tabular-nums`, `HH:mm` for today, `DD MMM HH:mm` otherwise; full timestamp in the tooltip. Pinned column. |
| 2 | `actor_name` | Actor | 200 | ✅ | — | avatar (image or a monogram/`>_` badge for system actors) + name; system/carrier/job actors render in muted style with a distinct badge |
| 3 | `action` | Action | 210 | ✅ | — | monospaced `action` key; the human sentence in the tooltip |
| 4 | `summary` | Detail | flexible | — | `md` | the `summary` line, truncated with a title tooltip |
| 5 | `entity_label` | Entity | 140 | — | `lg` | `tracking_id` / invoice number / member email, as a link to the entity |
| 6 | `ip` | IP | 120 | — | `lg` | monospace; `—` for system events |
| 7 | `severity` | Level | 100 | ✅ | — | dot + label, colour from the severity tokens (`info` neutral, `warn` amber, `error` rose) |

**Configuration**

```tsx
<DataTable
  data={events}
  columns={auditColumns}
  rowId={(e) => e.id}
  rowLabel={(e) => `${e.action} by ${e.actor_name} at ${e.occurred_at}`}
  caption="Audit events for this workspace, newest first."
  variant="bordered"
  density="compact"
  searchable
  searchPlaceholder="Search events, actors, entities…"
  quickFilter={{ columnId: 'severity', label: 'Filter by level' }}
  selectable
  bulkActions={({ rows, clear }) => <ExportSelection rows={rows} onDone={clear} />}
  renderDetail={(e) => <AuditDiff changes={e.changes} meta={e} />}
  resizableColumns
  pinFirstColumn
  stickyHeader
  maxHeight={640}
  keyboardNavigation
  clipboard
  pageSize={50}
  defaultSort={{ columnId: 'occurred_at', direction: 'desc' }}
  loading={isFetching}
  emptyState={<EmptyState … />}
/>
```

**Requirements beyond the demo block**

1. **Diff disclosure.** `renderDetail` shows the `changes` object as a field-level before/after table (`field | from | to`), plus `request_id`, `user_agent` and `source`. Changed values are highlighted; a null `from` renders as `—`.
2. **Server paging at 50 rows**, with `total` shown. A pinned-340px-scroll variant is used on the dashboard's "Recent activity" card and the shipment detail's Activity tab.
3. **Filter row above the table:** date range (default last 7 days, with Today / 7d / 30d / custom presets), actor (async `multiple-selector` over the tenant's users + the system actor values), action namespace (multi-select from the closed key list), severity (the quick-filter pills), entity type. All of it maps to the URL.
4. **Export** honouring the current filters: CSV via `/audit/export`, and JSON Lines via `/audit/export.json`. Both gated by `audit:export`, both audited (`export.requested`).
5. **Live tail (optional, ship if cheap).** A "Live" toggle that polls every 10 s and prepends new rows with the component's entrance motion. Off by default; never steals scroll position or interrupts a selection.
6. **Immutability is visible.** A one-line note under the toolbar: rows are append-only; nothing here can be edited or deleted. The demo block's delete affordance is removed (`onDelete` is not wired for audit).
7. **Read-only for `viewer`, invisible to roles without `audit:read`.** Export additionally requires `audit:export`.
8. **Where else it appears:** dashboard "Recent activity" (compact, 10 rows, no toolbar), shipment detail Activity tab (pre-filtered to the entity), team member drawer (pre-filtered to the actor).
9. **Accessibility:** the `caption` is always present; the first Tab stop enters the grid and arrow keys move the cursor (`keyboardNavigation`); each row's label names the action and time (§11.2 `rowLabel`).
10. **Never mask away the point of the log:** tracking IDs in audit rows follow `full` masking by default (§8.3) — an audit log that leaks IDs to every reader is worse than no audit log. Readers with `tracking:reveal` see them via a per-row reveal that is itself audited.
11. **Performance:** index `(tenant_id, occurred_at DESC)`, `(tenant_id, actor_id)`, `(tenant_id, entity_type, entity_id)`, and `(tenant_id, action)`. Keyset pagination is acceptable and preferred above 100k rows per tenant.

---

## 12. Theming

### 12.1 Mechanism

- **`next-themes`** with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`, and a `ThemeProvider` client wrapper mirroring the pattern used by Spectrum UI's own site:

```tsx
"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
export function ThemeProvider({ children, ...props }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- The `.dark` class on `<html>` drives every token, exactly as the design system expects.
- A blocking inline script (next-themes handles it) sets the class before paint. **No flash of the wrong theme** — verify with a hard reload in both modes and with the OS switched mid-session.

### 12.2 The toggle

Port Spectrum's `ThemeToggle` component pattern: a three-state pill (light · system · dark) with a `motion` `layoutId` indicator sliding between the active option, `whileTap={{ scale: 0.95 }}`, `aria-label` per option and `aria-pressed` on the active one, and a mounted guard so the server render doesn't mismatch.

Placement: topbar (desktop) and the "More" drawer (mobile). Additional touch: `C` keyboard shortcut, and a `cmd+shift+L` alias to avoid clashing with the command palette.

The choice persists via `next-themes` (localStorage) **and** is written to the user record (`theme_pref`) on login so it follows the operator to another machine. Precedence: user record → local storage → OS.

### 12.3 Token architecture

Tokens are the shadcn/Tailwind v4 semantic set, declared in `app/globals.css` as CSS variables in `:root` and `.dark`, and mapped in `@theme inline` so utilities (`bg-card`, `text-muted-foreground`, `border-border`) resolve to them:

`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring`, `--radius`, `--chart-1`…`--chart-5`, `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`.

House rules:

- Base palette is neutral (zinc-family) for both themes. Accent is **sky blue**; green appears only as a success/status colour.
- A component never contains a hex value or a raw Tailwind palette class (`bg-zinc-100`). It uses a semantic utility (`bg-muted`) or a token-backed arbitrary value (`bg-[var(--status-delayed)]`).
- Tenant theme overrides (`theme_primary`, `theme_accent`, …) are injected as an override block on `:root`/`.dark` at render time, so white-labelling never touches a component.

### 12.4 Status colours (v1's `*_STATUS_META` maps, rebuilt as dual-theme tokens)

Replace v1's single-mode hex pairs with variable pairs that hold up in both themes:

| Status | Token | Light | Dark |
|---|---|---|---|
| `pickup` | `--status-pickup` / `--status-pickup-bg` | `#7c3aed` / `#ede9fe` | `#c4b5fd` / `#2e1065` |
| `warehouse` | `--status-warehouse` / `-bg` | `#0284c7` / `#e0f2fe` | `#7dd3fc` / `#082f49` |
| `in_transit` | `--status-in-transit` / `-bg` | `#d97706` / `#fef3c7` | `#fcd34d` / `#451a03` |
| `delivered` | `--status-delivered` / `-bg` | `#059669` / `#d1fae5` | `#6ee7b7` / `#022c22` |
| `delayed` | `--status-delayed` / `-bg` | `#dc2626` / `#fee2e2` | `#fda4af` / `#4c0519` |

Same treatment for lead statuses (`new`, `contacted`, `negotiation`, `won`, `lost`), invoice statuses (`paid`, `pending`, `overdue`), and audit severities (`info`, `warn`, `error`). Deliverable: a `/settings/design` (dev-only, `NODE_ENV !== 'production'`) page that renders every status chip in both themes side by side so contrast can be eyeballed in one screen.

Requirement: status text meets **4.5:1** against its chip background in both themes; status is never communicated by colour alone (always dot + label, or icon + label) — this also covers the `warn`/`error` audit levels.

### 12.5 Typography, spacing, radii, elevation

- Font: Inter (variable) with `font-feature-settings: 'cv11','ss01'`; JetBrains Mono for identifiers/IPs/action keys.
- Type scale: 12 / 13 / 14 / 16 / 20 / 24 / 30 / 38. Body is 14px (v1's choice, keep it — it suits dense operational tables).
- Spacing: 4px base; card padding 20px desktop / 16px mobile; table row height by density (`compact` 36px, `default` 44px, `relaxed` 56px).
- Radius: 10px container, 8px control (v1's values, kept).
- Elevation: two levels only — `--shadow-sm` for cards, `--shadow-lg` for overlays. Dark mode uses a lighter border instead of a heavier shadow.

### 12.6 Contrast and accessibility of theming

- Both themes must pass WCAG 2.2 AA on text and on non-text UI (borders of inputs, focus rings).
- Focus is never removed: `--ring` renders a 2px offset ring visible in both themes.
- Chart palettes define `--chart-1…5` per theme; chart legends use shape + label, not colour alone.
- Playwright runs the critical flows in both themes at 390px and 1440px widths; a screenshot diff of the same page in both modes is part of the review.

### 12.7 Locale conventions

- Storage: UTC milliseconds. Display: `Asia/Kolkata` (tenant-configured) via `formatDateIst`/`formatDateTimeIst` in `packages/shared`.
- Currency: integer paise → `₹1,24,500.00` with Indian digit grouping (`Intl.NumberFormat('en-IN')`). A `usd` formatter exists for cross-border quotes.
- Numbers: tabular figures in tables (`numeric` column flag), lakh/crore grouping in aggregates above 1,00,000.

---

## 13. Mobile and responsive specification

### 13.1 Breakpoints

`sm 640` · `md 768` · `lg 1024` · `xl 1280` · `2xl 1536`. Four layouts are designed: mobile (390), large mobile/small tablet (430–767), tablet (768–1023), desktop (≥1024). v1's `1080/900/640` reflow points are discarded.

### 13.2 Navigation

| Viewport | Pattern |
|---|---|
| ≥1024 | Fixed sidebar (`@spectrumui/sidebar-navbar`), collapsible to a 64px icon rail, state persisted per user |
| 768–1023 | Sidebar defaults to the icon rail; expands as an overlay on demand |
| <768 | Bottom `@spectrumui/tab-navbar` (Dashboard · Shipments · Leads · More); "More" opens an `animated-drawer` with Invoices, Audit, Team, Settings, theme toggle and sign-out. Safe-area padding for iOS home indicator. |

### 13.3 Modals become drawers

Under 768px, every modal (create shipment, log status, invite member, invoice editor) renders as an `@spectrumui/animated-drawer` (vaul) with a drag handle, snapping detents, and the primary action pinned above the thumb zone. Desktop keeps a shadcn `Dialog`. One component, two presentations, chosen by a `useMediaQuery` hook — not two implementations.

### 13.4 Tables on small screens

The Data Table's own mechanisms do the work — no separate mobile markup:

- `hideBelow` drops low-priority columns (`ip`, `entity`, `summary`) per §11.7.
- Rows become tall, tappable cards in spirit: on mobile the shipments table runs `density="relaxed"` with `pinFirstColumn` (tracking ID + status) so identity and state stay visible while the rest scrolls.
- Tap a row → full-screen detail page (not a drawer) for shipments and invoices; leads and audit use `renderDetail` disclosure instead.
- Bulk selection remains available but the bulk bar docks above the tab bar, never behind it.
- Horizontal scroll is always possible, never required, and never the only way to reach an action.

### 13.5 Thumb reach and primary actions

- The primary action on every screen sits within the bottom third on mobile (FAB above the tab bar, or the drawer's pinned footer button).
- Destructive actions on mobile require a confirmation (`AlertDialog`), unlike desktop, where an undo toast is used. Physical tap targets are ≥44×44px.

### 13.6 Touch, motion and input

- Hover-only affordances (`rowActions` on hover) get a touch equivalent: a trailing chevron button always visible on mobile.
- `prefers-reduced-motion` disables non-essential motion; `DataTable animate={false}`; no parallax anywhere.
- Inputs use `inputMode` and `autoComplete` correctly (numeric for weight/pincode, `tel` for phone, `email` for email) — the field forms are used on phones by warehouse staff.
- The public tracking page is designed mobile-first; it is the screen customers open from a WhatsApp link.

---

## 14. Screens

Each screen lists its purpose, data, Spectrum UI components, states and acceptance criteria. Field-level detail comes from §6; do not add fields not in §6 without updating it.

### 14.1 Login (`/login`)

- Components: `@spectrumui/login-card`, `@spectrumui/floating-label-input`, `@spectrumui/loading-button`.
- Real credentials against `/auth/login`; no mock acceptance. Demo accounts from §2.2 are listed in a dev-only block when `NEXT_PUBLIC_DEMO_MODE=1`.
- States: idle, submitting (inline button spinner), invalid credentials (field-level error, no toast), rate-limited (calm message with a countdown).
- Sign-up creates an `owner` account plus a tenant — the v1 behaviour, made real. Invite-only signup is a tenant setting.
- Acceptance: wrong password fails; a `dispatcher` lands on the dashboard without invoices in the nav; the failed attempt appears in the audit log as `auth.login_failed`.

### 14.2 Dashboard (`/`)

- Components: `@spectrumui/stat-cards`, `@spectrumui/insight-cards`, `@spectrumui/chart-kit`, Data Table (compact activity variant), `@spectrumui/calendar-heatmap`.
- Content: four KPI cards (Active shipments, Delayed, Out for delivery today, Revenue this month) each with a sparkline and a period-over-period delta; a shipment-by-status chart; a delay-reason breakdown; a "Recent activity" audit table (10 rows); a "Needs attention" list (delayed shipments, overdue invoices, leads with today's follow-up).
- Every card is clickable and lands on the corresponding filtered list (KPI → `/shipments?status=delayed`).
- States: skeleton cards on first load; a "partial data" banner if one aggregate fails while others succeed.
- Acceptance: numbers reconcile with the corresponding list pages' `total`.

### 14.3 Shipments list (`/shipments`)

- The core operational screen. Full-table engine config per §11.3.
- Columns: Tracking ID (masked, copy button, pin), Client, Route (origin → destination), Carrier, Status chip, Assigned to (avatar), Expected delivery (with an overdue marker), Last update.
- Header: title + count, `Create shipment` primary button, Export CSV, density toggle, column visibility.
- Filters: status pills (all / pickup / warehouse / in transit / delivered / delayed / awaiting carrier ID), carrier, client, assignee, date range. URL-backed.
- Bulk actions: assign, log status, export, delete (permission-gated; `onDelete` semantics per §11.2).
- Row actions: Log status (opens the checkpoint drawer), Reveal tracking (audited), Open carrier tracking URL, Copy masked ID.
- `renderDetail`: last three checkpoints inline, so the desk doesn't have to open the shipment.
- Mobile: §13.4.
- Acceptance: filters survive a reload and the back button; a `dispatcher` sees only assigned shipments and cannot reveal IDs; exporting a filtered list exports exactly the visible filter set.

### 14.4 Create shipment

- Presentation: a `Dialog` on desktop, an `animated-drawer` on mobile; a three-step flow (Consignment → Carrier & service → Review) because v1's single long form was the main complaint.
- Step 1: client (async `multiple-selector`, creatable), origin/destination (city + pincode), packages (`quantity-stepper`), weight, declared value, service level, payment mode, reference/invoice number, notes (`autosize-textarea`).
- Step 2: carrier (`multiple-selector`), expected delivery (`datetime-picker`, defaulted from service level), assignee (async select over team), and — if the carrier adapter supports booking — a "Book with carrier now" toggle.
- Step 3: review card, then Create. The response returns our tracking ID, displayed immediately with a copy button and an inline "Add the carrier's docket number" affordance (`inline-edit`).
- Optimistic list insert with a skeleton row; rollback + toast on failure.
- Acceptance: creating a shipment issues a unique `5LX-` ID, writes `shipment.created` + `shipment.tracking_assigned` audit rows, resolves or creates the client, and appears in the list without a manual refresh.

### 14.5 Shipment detail (`/shipments/:id`)

- Header: masked tracking ID with reveal (audited) + copy, status chip, client, `Quick actions` (Log status, Assign, Edit, Book with carrier, Export POD).
- Sections: **Overview** (all §6.1 fields, inline-editable with `inline-edit` where permitted), **Tracking** (two IDs side by side — ours and the carrier's — each with its own reveal/copy state and a link to the carrier's tracking URL), **Timeline** (`@spectrumui/status-tracker` over checkpoints, grouped by day, each entry showing who logged it, `source` badge for automated events), **Invoices** (linked invoices, amount as headline), **Attachments** (PODs, uploaded invoices), **Activity** (the audit table pre-filtered to this entity).
- Log status: a drawer with the status stepper, location, note, an `occurred_at` picker, and a **mandatory delay reason** when `delayed` is chosen (inline validation, matches the DB constraint).
- Acceptance: logging a delayed checkpoint without a reason is impossible in the UI *and* rejected by the API; the timeline updates optimistically and the audit table gains one row on the same screen without a reload.

### 14.6 Analytics

- v1's `ShipmentStats` becomes a section of the dashboard plus a dedicated `/analytics` route for `analytics:view` roles.
- Components: `chart-kit` (bar, line, area, pie, sparkline), `stat-cards`, `calendar-heatmap`.
- Content: volume by status over time; on-time vs delayed ratio; average transit time per carrier; top delay reasons; shipments per client; revenue per client; a per-day delay heatmap.
- All charts export as CSV from the same underlying query as the list.

### 14.7 Leads (`/leads`)

- Default view: `@spectrumui/kanbanboard` with five columns (new → contacted → negotiation → won/lost), drag to change status (audited). Table view toggle for comparison (Data Table config in §11.3).
- Lead drawer: contact details, source, expected value, follow-up date (`datetime-picker`), activity feed (append note/call/email), conversion action ("Convert to client" → creates a `Client` and links `converted_client_id`).
- Mobile: stacked cards grouped by status, swipe to advance.
- Acceptance: a `sales` user sees all leads; a `dispatcher` sees only assigned ones; each status move writes `lead.status_changed` with `from`/`to`.

### 14.8 Invoices (`/invoices`)

- Table per §11.3 with amount as the headline and `totals` on amount columns (a live footer that recounts as filters change).
- Invoice editor: line items linking to shipments, tax as basis points, totals computed server-side, GST fields on the client and tenant.
- Status changes (`pending` → `paid`) are audited with the timestamp; `overdue` is also set by the `invoice_overdue_sweep` job, and those rows are attributed to the system actor.
- Acceptance: a `dispatcher` cannot see this route or its nav item; totals match the sum of lines to the paisa.

### 14.9 Audit log (`/audit`)

Full specification in §11.7. Route gated on `audit:read`, export on `audit:export`.

### 14.10 Team (`/team`)

- `@spectrumui/team-members-table` structure over the Data Table: name, email, role (inline select), scope summary, last login, active toggle, actions.
- Invite flow: email + role → invite token → the invited user sets a password. `team.role_changed`, `team.deactivated`, `team.invited` are all audited.
- A role change shows a diff in its audit row (`role: { from: 'dispatcher', to: 'ops_manager' }`).
- Acceptance: the last remaining `owner` cannot be demoted or deactivated (server-enforced, with a specific error code).

### 14.11 Settings (`/settings`)

Sections in an `accordion`, with `tree-nav` for desktop sub-navigation: **Profile** (name, phone, avatar, theme preference, notification prefs), **Brand** (the tenant's `BrandConfig` fields, with a live preview strip), **Carriers** (CRUD + adapter selection + webhook secret rotation, audited), **Clients**, **Statuses & reasons** (editable delay-reason and lead-source vocabularies — currently constants in v1), **Tracking** (prefix, mask policy, public-page toggle), **Team & roles**, **Danger zone** (export all data, delete tenant).

### 14.12 Public tracking (`/track/:trackingId`)

- No auth. Its own minimal shell. Mobile-first.
- Input accepts our tracking ID or a carrier docket number; both are validated for plausibility before the request.
- Result: current status as a big status chip, the checkpoint timeline (`status-tracker`), origin → destination, expected delivery, package count, and a "last updated" line. **No** client name, phone, or declared value. Carrier ID masked `first2_last2` (§8.3).
- Share-worthy: Open Graph meta with status and ETA; a "Notify me on WhatsApp/email" opt-in (email only in v2).
- Errors: an unmatched ID yields a calm "We couldn't find that consignment" (never "not found in database", never a distinction between wrong-format and unknown — that distinction is an enumeration oracle). Rate limit per §9.8.
- Acceptance: the four v1 demo IDs resolve correctly; 429 after the rate limit; the page passes a mobile Lighthouse accessibility run ≥95.

---

## 15. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | List pages: first contentful paint <1.2s on a mid-range Android over 4G, ≤25 table rows per page, keyset pagination available. Route-level code splitting; Spectrum components imported per-route, never from a barrel that pulls the whole registry. |
| Accessibility | WCAG 2.2 AA. Full keyboard operation of every table (`keyboardNavigation`), visible focus, labelled controls, `caption` on every table, no colour-only status, min 4.5:1 text contrast in both themes. Playwright + axe on every route in both themes. |
| i18n readiness | All strings through a message catalogue (`messages/en.json`); no literal UI copy in components. `en-IN` first; `hi-IN` prepared (dates, numbers, and the message file exist). |
| Observability | Structured logging (pino) with `request_id`; `/health`; error tracking hook (Sentry-compatible interface, disabled locally); every failed mutation logged with its error code. |
| Data retention | Audit events: 24 months hot, then archived; documented retention notice in the UI. Shipments/checkpoints: indefinite. Deletions are soft with an audit row. |
| Backups | `data/dev.db` backed up by copy; production = Postgres PITR. `pnpm db:export` writes a portable JSON snapshot (all tables) for handover and for tenant data export. |
| Browser support | Last 2 versions of Chrome, Safari, Firefox, Edge; iOS Safari 16+, Chrome Android 120+. |
| Timezone | All storage UTC; all display tenant-local; a DST-safe formatter (India has none, but the code must not assume that). |

---

## 16. Milestones for the agent

Build in this order. Each milestone ends with tests passing and a demoable state.

| # | Milestone | Deliverable | Done when |
|---|---|---|---|
| 0 | Scaffold | pnpm workspace, Next.js 15, Tailwind v4, shadcn init, Spectrum registry registered, theme provider + toggle, token layer with status tokens | Toggling light/dark/system works with no flash across every route; a dev-only design page shows all tokens both ways |
| 1 | Contracts & DB | `packages/contracts` (all Zod schemas, enums, audit actions), `packages/db` (schema, migration, repository skeleton), seed script | `pnpm db:setup` produces a populated SQLite file; contract unit tests green |
| 2 | Mock layer + shell | MSW handlers for every route in §9.1, typed `api` client, app shell (sidebar, topbar, tab-navbar, command palette), auth screens with real Auth.js | The full nav works against mocks with `NEXT_PUBLIC_API_MODE=mock`; login sets a session and role-gated nav is correct |
| 3 | Shipments | List (table engine + filters + URL state), create flow, detail page (overview, tracking reveal, timeline, log-status drawer) | §14.3–14.5 acceptance criteria pass on desktop and at 390px |
| 4 | Audit log | `audit_events` store, `recordAudit` wired into every mutation, `/audit` table per §11.7, exports | Every action in §9.2 produces a row; the table renders 500 seeded rows smoothly; export respects filters |
| 5 | Invoices & clients | Invoice CRUD, lines, totals, statuses, client entity + resolution, exports | §14.8 acceptance criteria pass |
| 6 | Leads | Kanban + table, drawer, activity feed, conversion | §14.7 passes; status moves audited |
| 7 | Team, settings, brand | RBAC matrix enforcement, team management, tenant brand config, tracking settings, vocabularies | A permission-matrix test suite proves every role × every endpoint; the last-owner guard holds |
| 8 | Dashboard, analytics, notifications | KPI cards, charts, needs-attention lists, notification centre, email adapter | §14.2 passes; a delay notification arrives in-app and as a `.eml` locally |
| 9 | Public tracking + carriers | `/track` page, rate limiting, mock adapter end-to-end, real adapter stubs | v1 demo IDs resolve; a mock carrier booking writes a carrier tracking ID |
| 10 | Hardening & handover | Playwright suite (both themes, 390/1440), axe run, Lighthouse, `docs/API.md` + `openapi.json`, README, ADRs, data export | §16 checklist complete; a second developer can run the app from a clean clone in under 5 minutes |

---

## 17. Backend decisions taken on the client's behalf (summary for handover)

The client owns design and frontend. These choices are made now so the backend has no blank page, and each is reversible with a documented cost.

| Decision | Choice | Reversal cost |
|---|---|---|
| Language/runtime | TypeScript + Node 22, one language across both halves | High — but the choice is what makes a single engineer able to own both |
| Framework | Next.js 15 App Router (UI + API in one deployable) | Medium — route handlers are thin; the repositories and contracts port to Express/NestJS untouched |
| Database (local) | SQLite single file | None — one config flag |
| Database (prod) | PostgreSQL | None — same schema, dialect switch |
| ORM | Drizzle | Medium — the repository layer is the seam; swapping to Prisma touches only `packages/db/repositories` |
| Auth | Auth.js v5 + DB sessions + argon2id | Medium — the `sessions`/`accounts` tables match what Supabase Auth or Clerk expect |
| API style | REST + Zod + OpenAPI | Low — no client is coupled to a server-only library |
| Mock strategy | MSW generated from contracts | None — delete the MSW folder for production and remove one env var |
| Money/time/ID conventions | Integer paise, UTC ms, cuid2 | Low, if declared early — that is why they are in §4.2 |
| Carrier integration | Adapter interface + mock default + typed stubs | Low — each adapter is a file with a documented TODO |
| Jobs | DB-backed jobs + worker script, Vercel Cron in prod | Low — the job functions are plain async functions |
| Files | Local `./storage` behind a `FileStore` interface | Low — an S3 adapter implements the same interface |

### 17.1 Environment variables (`.env.example`, placeholders only)

```
DATABASE_DIALECT=sqlite
DATABASE_URL=file:./data/dev.db
AUTH_SECRET=[REDACTED]
NEXT_PUBLIC_API_MODE=mock|live
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEMO_MODE=1
SEED_PASSWORD=[REDACTED]
RESEND_API_KEY=[REDACTED]
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=./storage
CARRIER_DTDC_API_KEY=[REDACTED]
CARRIER_DELHIVERY_API_KEY=[REDACTED]
RATE_LIMIT_DRIVER=memory|redis
```

### 17.2 Commands the next engineer will type

```bash
pnpm install
pnpm db:setup          # create + migrate + seed
pnpm dev               # Next.js on :3000 (mock API by default)
pnpm dev:live          # :3000 against the local SQLite API
pnpm worker            # background jobs
pnpm test              # vitest (unit, contracts, rbac matrix)
pnpm test:e2e          # playwright (desktop + mobile, light + dark)
pnpm contracts:openapi # regenerate docs/openapi.json
pnpm db:export         # portable JSON snapshot of every table
```

### 17.3 Open decisions for the humans

1. **Product name.** "LogiFlow" is the v1 working name. A launch name needs a domain and a conflict check (.com/.in/.app) before it enters the codebase — rename cost is near zero while the brand is a single tenant row, and rises after launch.
2. **Single-tenant or multi-tenant at launch.** The schema is multi-tenant from day one. Whether a second customer is onboarded in month one changes the hosting and the invite flow, not the code.
3. **Hosting.** Vercel (simplest, matches Next.js) vs a VPS (cheaper at scale, more work). Affects cron and the storage driver only.
4. **GST/e-invoicing depth.** v2 stores GSTIN and a tax rate per line. Full e-invoice IRN generation is out of scope unless the pilot client requires it.
5. **WhatsApp notifications.** The pilot client's customers live on WhatsApp. Deferred in v2 (email only) but the `NotificationChannel` interface leaves room.
6. **Hindi UI.** The catalogue supports it; the pilot client's warehouse staff may need it sooner than expected.
7. **Scope of Fable 5.1's implementation run.** Recommended: milestones 0–5 first (scaffold through invoices) — that is a coherent, demoable product — then 6–10.

---

## 18. Out of scope for v2 (state explicitly, implement nothing here)

- Real carrier API integrations beyond the mock adapter and typed stubs.
- Payments, payment gateways, or automatic reconciliation.
- E-way bill / e-invoice IRN generation.
- Route optimisation, fleet telematics, or driver mobile app.
- Warehouse management (bin locations, inventory).
- Customer self-service portal beyond the public tracking page.
- Multi-currency accounting beyond a display formatter.
- Native mobile apps (the web app is the mobile app).
- Migrating v1's data — v1 has no persistence to migrate.

---

## 19. Acceptance test matrix (the definition of done)

| # | Test | Pass condition |
|---|---|---|
| 1 | Clean clone → run | `pnpm install && pnpm db:setup && pnpm dev` works on Windows, macOS and Linux with no manual edits |
| 2 | Theme | Light, dark and system are all correct on every route; the choice survives reload and login; no flash; both themes pass axe |
| 3 | Permission matrix | Automated test iterates all 7 roles × all permission keys × all endpoints, asserting allow/deny and row scoping |
| 4 | Tracking IDs | Internal ID unique per tenant, immutable; carrier ID separate; masking applied server-side for every role; reveal audited; no raw ID in any response payload without `tracking:reveal` |
| 5 | Audit completeness | Every mutation in §9.1 writes exactly one audit row with actor, diff, IP and request id; `UPDATE`/`DELETE` on `audit_events` is rejected by the database; export respects filters |
| 6 | Audit table | Renders 500 seeded rows with sorting, search, level pills, resize, pinned first column, keyboard navigation and clipboard; diff disclosure shows before/after |
| 7 | Table engine | No raw `<table>` anywhere in `apps/web` (lint rule); all list surfaces use the Spectrum Data Table |
| 8 | No bespoke primitives | No new `Modal`/`StatusBadge`/`Card`-style hand-rolled component exists outside `components/spectrumui` and `components/app` compositions |
| 9 | Mobile | All §13 behaviours verified at 390px; tab bar, drawers, no horizontal-scroll-only actions, 44px targets |
| 10 | States | Every data surface has loading (skeleton), empty, filtered-empty and error states |
| 11 | Public tracking | v1 demo IDs resolve; rate limit works; no PII leaks; carrier ID masked |
| 12 | Handover | README + ADRs + `openapi.json` + seed + `db:export` all present; a second developer's clean run takes <5 minutes |
| 13 | Design cohesion | Sibling pages share header rhythm, empty states, skeletons and toolbar layout; a reviewer cannot tell which screen was built first |

---

## Appendix A — reference URLs

- Original project (v1): `https://github.com/VishyFishy7/five-logistics`
- Original live prototype: `https://five-logistics.vercel.app`
- Design system: `https://github.com/arihantcodes/spectrum-ui` (Apache-2.0)
- Design system site: `https://ui.spectrumhq.in` · palette browser: `https://ui.spectrumhq.in/colors`
- Spectrum UI MCP setup: `https://ui.spectrumhq.in/docs/mcp`
- MCP install: `claude mcp add spectrum-ui -- npx -y @spectrumui/mcp`

## Appendix B — v1 terminology → v2

| v1 | v2 |
|---|---|
| `carrier` (string on shipment) | `carrier_id` FK → `carriers`, with `code` preserving the v1 string |
| `trackingId` | `tracking_id` (ours) + `carrier_tracking_id` (theirs) |
| `client` (string) | `client_id` FK → `clients`, free-text accepted at the edge |
| `checkpoints[]` | `checkpoints` table (same fields, plus `source`, `raw_payload`) |
| `byUserName` on checkpoint | derived from `by_user_id` at read time; stored denormalised for the timeline |
| `invoice.shipmentIds[]` | `invoice_lines.shipment_id` |
| `AppNotification` | `notifications` (with `channels_sent`, `read_at`) |
| `brand` config module | `tenants` row + optional env override |
| `ROLE_PERMISSIONS` booleans | permission keys (§7.2) |
| `SHIPMENT_STATUS_META` hex pairs | dual-theme status tokens (§12.4) |

## Appendix C — the four v1 demo tracking IDs (seed these)

| Tracking ID | Status | Used to demonstrate |
|---|---|---|
| `5LX-DT58K7` | delayed | delay reason + delay analytics + the warn-severity audit row |
| `5LX-AX84Q2` | in_transit | carrier sync + checkpoint timeline |
| `5LX-CQ93T5` | delivered | `delivered_at`, POD attachment, invoice link |
| `5LX-EF61M3` | pickup | earliest-state flows, unassigned-then-assigned |

---

*End of document. Feed this file, unmodified, to the agent.*
