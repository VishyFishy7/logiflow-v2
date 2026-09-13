import type { NextConfig } from "next";

/**
 * The workspace packages ship TypeScript source, not build output (§4.4), so
 * Next compiles them as part of the app. `better-sqlite3` is a native module
 * and must stay external to that compilation.
 */
const nextConfig: NextConfig = {
  // Transpile only the non-native workspace packages
  transpilePackages: ["@logiflow/contracts", "@logiflow/shared"],
  serverExternalPackages: ["better-sqlite3"],
  typedRoutes: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Resolve .js imports to .ts files in workspace packages
    config.resolve = config.resolve || {};
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    // Externalize @logiflow/db to prevent bundling native deps
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        // Add @logiflow/db and its subpaths as external
        config.externals.push((ctx: any, callback: any) => {
          if (ctx.request && ctx.request.startsWith("@logiflow/db")) {
            return callback(null, `module ${ctx.request}`);
          }
          callback();
        });
      }
    }
    return config;
  },
};

export default nextConfig;
