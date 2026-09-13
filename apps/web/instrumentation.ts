export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { getSqlite } = await import("@logiflow/db");
      const sqlite = getSqlite();
      const { readdirSync, readFileSync } = await import("node:fs");
      const { resolve } = await import("node:path");
      const candidates = [
        resolve(process.cwd(), "packages/db/migrations"),
        resolve(process.cwd(), "../packages/db/migrations"),
        "/vercel/path0/packages/db/migrations",
      ];
      for (const dir of candidates) {
        try {
          const files = readdirSync(dir).filter((f: string) => f.endsWith(".sql")).sort();
          if (files.length === 0) continue;
          sqlite.exec(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);`);
          const applied = new Set((sqlite.prepare("SELECT name FROM _migrations").all() as {name:string}[]).map(r=>r.name));
          for (const file of files) {
            if (applied.has(file)) continue;
            const body = readFileSync(resolve(dir, file), "utf8");
            const run = sqlite.transaction(() => {
              sqlite.exec(body);
              sqlite.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(file, Date.now());
            });
            run();
            console.log(`[instrumentation] applied ${file}`);
          }
          break;
        } catch {}
      }
    } catch (e) {
      console.error("[instrumentation] db auto-migrate failed", e);
    }
  }
}
