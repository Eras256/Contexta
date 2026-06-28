import { defineConfig } from "vitest/config";

/**
 * Vitest handles unit tests under src/ only. Playwright specs live in e2e/ and
 * are run separately via `pnpm test:e2e` (they must not be collected by vitest).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
