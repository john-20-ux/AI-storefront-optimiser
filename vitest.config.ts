import { defineConfig } from "vitest/config";

// Standalone Vitest config so the scoring engine (pure TS) can be tested without
// the Shopify/React Router Vite plugin pipeline.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
