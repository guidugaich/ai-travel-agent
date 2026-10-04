import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{packages,apps}/*/src/**/*.test.ts"],
    // Remove in Phase 3, once the harness adds real tests.
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["{packages,apps}/*/src/**/*.ts"],
      exclude: ["**/*.test.ts"],
      reporter: ["text-summary", "lcov"],
    },
  },
});
