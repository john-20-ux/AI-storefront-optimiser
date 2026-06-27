import { test, expect } from "@playwright/test";

// Public-surface checks against the deployed app (no Shopify session required).

test("health check returns ok", async ({ request }) => {
  const res = await request.get("/healthz");
  expect(res.status()).toBe(200);
  expect(await res.text()).toBe("ok");
});

test("landing page responds", async ({ request }) => {
  const res = await request.get("/");
  expect(res.ok()).toBeTruthy();
  expect((await res.text()).length).toBeGreaterThan(0);
});

test("OpenRouter start rejects an invalid signed token", async ({ request }) => {
  const res = await request.get("/openrouter/start?token=bad", { maxRedirects: 0 });
  expect(res.status()).toBe(400);
});

test("OpenRouter callback rejects without the state cookie (CSRF)", async ({ request }) => {
  const res = await request.get("/openrouter/callback?state=abc&code=xyz", { maxRedirects: 0 });
  expect(res.status()).toBe(400);
});

test("OpenRouter callback rejects missing params", async ({ request }) => {
  const res = await request.get("/openrouter/callback", { maxRedirects: 0 });
  expect(res.status()).toBe(400);
});
