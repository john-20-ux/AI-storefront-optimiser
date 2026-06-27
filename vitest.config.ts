import { defineConfig } from "vitest/config";

// Test Postgres: local PG16 on 5433 by default; overridable for CI.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://john@localhost:5433/ai_storefront_optimizer_test";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/setup/globalSetup.ts"],
    // Integration tests share one Postgres; run files serially so per-test
    // resetDb() in one file can't wipe another file's rows mid-run.
    fileParallelism: false,
    // Deterministic env for all tests (no real provider keys needed).
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      ENCRYPTION_KEY: "a".repeat(64),
      SHOPIFY_API_SECRET: "test-shopify-secret",
      SHOPIFY_APP_URL: "https://test.example.com",
      NODE_ENV: "test",
    },
  },
});
