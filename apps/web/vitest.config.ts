import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["mocks/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@logiflow/contracts": "C:/Users/gamer/projects/logiflow-v2/packages/contracts/src/index.ts",
      "@logiflow/shared": "C:/Users/gamer/projects/logiflow-v2/packages/shared/src/index.ts",
    },
  },
});
