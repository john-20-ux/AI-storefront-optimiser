import { defineConfig } from "@playwright/test";

// Public-route E2E against the deployed app. These use Playwright's HTTP request
// fixture only (no browser binaries needed). The embedded/admin flow requires a
// Shopify dev-store session and is intentionally out of scope here.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000, // free Render dyno can cold-start ~60s
  retries: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "https://ai-storefront-optimizer.onrender.com",
  },
});
