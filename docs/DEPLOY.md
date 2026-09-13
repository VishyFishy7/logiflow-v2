# Deploying LogiFlow v2

Two supported setups. Both run the *same* front-end; only the data layer differs.

## 1. Demo / preview (default) — mock backend in the browser

`NEXT_PUBLIC_API_MODE=mock` runs the whole API as an MSW service worker inside the
browser, seeded from `@logiflow/contracts` fixtures. No database, no server state,
no env vars to configure, and mutations are held in memory for the session.

Use it for: previews, design reviews, PR screenshots, stakeholder demos.

## 2. Live — SQLite + Drizzle behind `/api/v1/*`

`NEXT_PUBLIC_API_MODE=live` makes the UI call the real route handlers
(`apps/web/app/api/v1/**`), which read/write SQLite through `@logiflow/db`.

Requires `DATABASE_URL`, `AUTH_SECRET` and `NEXTAUTH_URL` in `apps/web/.env.local`,
and a migrated + seeded database.

### Where live mode is allowed to run

SQLite needs a writable, persistent disk. That rules out serverless platforms:
Vercel's filesystem is read-only apart from `/tmp`, which is per-invocation. So:

| Target | Mode to use |
| --- | --- |
| Local machine | either |
| Vercel | mock |
| Container / VM with a volume (Fly, Railway, Hetzner, your Oracle VPS) | live |

To run live on a VPS, keep the SQLite file on the VM and point `DATABASE_URL` at it.

## Vercel

The repository is a pnpm monorepo; the deployable app is `apps/web`.

- **Root directory:** `apps/web`
- **Install command:** default (`pnpm install`, resolved from the workspace root)
- **Build command:** default (`next build`)
- **Environment variables:** none required for the demo. To force a mode
  explicitly, set `NEXT_PUBLIC_API_MODE` to `mock` or `live`.

### CLI

```bash
git push origin main                 # Vercel builds every push to main
vercel --prod                        # or deploy the working tree directly
```

Deploy from `apps/web` (or set Root Directory to `apps/web` in project settings) so
Vercel picks up the Next.js preset instead of looking for a framework at the repo root.

## Local

```bash
pnpm install
pnpm --filter web dev                # http://localhost:3000
pnpm --filter web build && pnpm --filter web start
```

Live mode only, first run:

```bash
pnpm --filter db migrate
pnpm --filter db seed
```

## Checks

```bash
pnpm --filter web exec tsc --noEmit   # types
pnpm test                             # contracts + db + web unit tests
pnpm --filter web lint                # eslint
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_MODE` | `mock` | `mock` = MSW in-browser API, `live` = real route handlers |
| `DATABASE_URL` | — | SQLite file path, live mode only |
| `AUTH_SECRET` | — | NextAuth signing secret, live mode only |
| `NEXTAUTH_URL` | — | Absolute app URL, live mode only |
