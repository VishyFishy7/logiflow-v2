import { defineConfig } from "drizzle-kit";

/**
 * `DATABASE_DIALECT` selects the engine (PRD §4.4): `sqlite` locally, `postgres`
 * in production. The schema modules are declared once in ./src/schema; the
 * mechanical Postgres port is scripted in ./src/dialect/port-to-postgres.ts and
 * documented in docs/adr.
 */
const dialect = (process.env.DATABASE_DIALECT ?? "sqlite") as "sqlite" | "postgres";

if (dialect === "postgres") {
  throw new Error(
    "Postgres dialect selected but no Postgres server is configured for this checkout. " +
      "Run `pnpm --filter @logiflow/db dialect:postgres` to emit the pg schema, then point " +
      "DATABASE_URL at your server. See docs/adr/0004-dialect-and-portability.md.",
  );
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "./data/logiflow.db",
  },
});
