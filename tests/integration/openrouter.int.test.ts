import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { createAuthorizeUrl, exchangeCode } from "../../app/lib/openrouter.server";
import { prisma, resetDb } from "../setup/db";

const SHOP = "demo.myshopify.com";

beforeEach(async () => {
  await resetDb();
  vi.restoreAllMocks();
});
afterAll(() => prisma.$disconnect());

describe("openrouter.server (DB + PKCE)", () => {
  it("createAuthorizeUrl stores state and builds a PKCE URL", async () => {
    const { state, url } = await createAuthorizeUrl(SHOP);
    expect(url).toContain("https://openrouter.ai/auth");
    expect(url).toContain("code_challenge=");
    expect(url).toContain("code_challenge_method=S256");
    expect(decodeURIComponent(url)).toContain(`/openrouter/callback?state=${state}`);

    const row = await prisma.oAuthState.findUnique({ where: { state } });
    expect(row?.shopDomain).toBe(SHOP);
    expect(row?.codeVerifier).toBeTruthy();
  });

  it("prunes states older than 15 minutes for the shop", async () => {
    await prisma.oAuthState.create({
      data: {
        state: "old-state",
        shopDomain: SHOP,
        codeVerifier: "v",
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    });
    await createAuthorizeUrl(SHOP);
    expect(await prisma.oAuthState.findUnique({ where: { state: "old-state" } })).toBeNull();
  });

  it("exchangeCode swaps code for a key and consumes the state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ key: "sk-or-xyz" }) }) as any),
    );
    const { state } = await createAuthorizeUrl(SHOP);
    const result = await exchangeCode(state, "auth-code");
    expect(result).toEqual({ shopDomain: SHOP, key: "sk-or-xyz" });
    // one-time use
    expect(await prisma.oAuthState.findUnique({ where: { state } })).toBeNull();
  });

  it("rejects an unknown state", async () => {
    await expect(exchangeCode("nope", "code")).rejects.toThrow(/invalid or expired/i);
  });

  it("rejects an expired state", async () => {
    await prisma.oAuthState.create({
      data: {
        state: "expired",
        shopDomain: SHOP,
        codeVerifier: "v",
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    });
    await expect(exchangeCode("expired", "code")).rejects.toThrow(/expired/i);
  });

  it("throws when OpenRouter returns a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400, json: async () => ({}) }) as any));
    const { state } = await createAuthorizeUrl(SHOP);
    await expect(exchangeCode(state, "code")).rejects.toThrow(/token exchange failed/i);
  });
});
