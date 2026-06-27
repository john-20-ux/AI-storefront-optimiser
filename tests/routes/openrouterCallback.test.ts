import { describe, it, expect, vi, beforeEach } from "vitest";

const { exchangeCode, saveConnection } = vi.hoisted(() => ({
  exchangeCode: vi.fn(),
  saveConnection: vi.fn(),
}));

vi.mock("../../app/lib/openrouter.server", () => ({ exchangeCode }));
vi.mock("../../app/lib/aiConnection.server", () => ({ saveConnection }));

import { loader } from "../../app/routes/openrouter.callback";

function req(query: string, cookie?: string) {
  return new Request(`https://app.example.com/openrouter/callback${query}`, {
    headers: cookie ? { cookie } : {},
  });
}

beforeEach(() => {
  exchangeCode.mockReset();
  saveConnection.mockReset();
});

describe("openrouter.callback loader (CSRF / browser-binding)", () => {
  it("400s when state or code is missing", async () => {
    const res = (await loader({ request: req("?code=x"), params: {} } as any)) as Response;
    expect(res.status).toBe(400);
    expect(exchangeCode).not.toHaveBeenCalled();
  });

  it("400s when the state cookie is absent (no browser binding)", async () => {
    const res = (await loader({ request: req("?state=abc&code=xyz"), params: {} } as any)) as Response;
    expect(res.status).toBe(400);
    expect(exchangeCode).not.toHaveBeenCalled();
  });

  it("400s when the cookie does not match the state param", async () => {
    const res = (await loader({
      request: req("?state=abc&code=xyz", "or_oauth_state=different"),
      params: {},
    } as any)) as Response;
    expect(res.status).toBe(400);
    expect(exchangeCode).not.toHaveBeenCalled();
  });

  it("exchanges + saves + redirects when cookie matches state", async () => {
    exchangeCode.mockResolvedValue({ shopDomain: "demo.myshopify.com", key: "sk-or-1" });
    const res = (await loader({
      request: req("?state=abc&code=xyz", "or_oauth_state=abc"),
      params: {},
    } as any)) as Response;
    expect(exchangeCode).toHaveBeenCalledWith("abc", "xyz");
    expect(saveConnection).toHaveBeenCalledWith("demo.myshopify.com", "openrouter", "sk-or-1", null);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/app/settings");
    expect(res.headers.get("set-cookie")).toMatch(/or_oauth_state=;/); // cleared
  });

  it("400s (and clears cookie) when the exchange fails", async () => {
    exchangeCode.mockRejectedValue(new Error("token exchange failed (400)"));
    const res = (await loader({
      request: req("?state=abc&code=xyz", "or_oauth_state=abc"),
      params: {},
    } as any)) as Response;
    expect(res.status).toBe(400);
    expect(saveConnection).not.toHaveBeenCalled();
  });
});
