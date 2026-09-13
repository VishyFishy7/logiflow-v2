import type { NextConfig } from "next";

/**
 * The workspace packages ship TypeScript source, not build output (§4.4), so
 * Next compiles them as part of the app. `better-sqlite3` is a native module
 * and must stay external to that compilation.
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@logiflow/contracts", "@logiflow/shared", "@logiflow/db"],
  serverExternalPackages: ["better-sqlite3"],
  typedRoutes: false,
  eslint: {
    // Lint is its own gate (`pnpm lint`), not a build blocker.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
