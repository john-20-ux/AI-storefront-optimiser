import { describe, it, expect, vi, beforeEach } from "vitest";

const { authenticate, saveConnection, deleteConnection, getCredential, testConnection } = vi.hoisted(() => ({
  authenticate: { admin: vi.fn() },
  saveConnection: vi.fn(),
  deleteConnection: vi.fn(),
  getCredential: vi.fn(),
  testConnection: vi.fn(),
}));

vi.mock("../../app/shopify.server", () => ({ authenticate }));
vi.mock("../../app/lib/aiConnection.server", async (importActual) => {
  const actual = await importActual<typeof import("../../app/lib/aiConnection.server")>();
  return { ...actual, saveConnection, deleteConnection, getCredential };
});
vi.mock("../../app/lib/crypto.server", () => ({ encryptionConfigured: () => true }));
vi.mock("../../app/ai/test.server", () => ({ testConnection }));

import { action } from "../../app/routes/app.ai-connection";

function form(fields: Record<string, string>) {
  const body = new URLSearchParams(fields);
  return new Request("https://app.example.com/app/ai-connection", { method: "POST", body });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticate.admin.mockResolvedValue({ session: { shop: "demo.myshopify.com" } });
});

describe("app.ai-connection action", () => {
  it("saves a valid connection (encrypted via saveConnection)", async () => {
    const res = await action({ request: form({ intent: "save", provider: "anthropic", apiKey: "sk-1", model: "" }), params: {} } as any);
    expect(saveConnection).toHaveBeenCalledWith("demo.myshopify.com", "anthropic", "sk-1", null);
    expect(res).toEqual({ ok: true });
  });

  it("rejects a missing key", async () => {
    const res: any = await action({ request: form({ intent: "save", provider: "openai", apiKey: "" }), params: {} } as any);
    expect(res.ok).toBe(false);
    expect(saveConnection).not.toHaveBeenCalled();
  });

  it("rejects an invalid provider", async () => {
    const res: any = await action({ request: form({ intent: "save", provider: "gemini", apiKey: "k" }), params: {} } as any);
    expect(res.ok).toBe(false);
    expect(saveConnection).not.toHaveBeenCalled();
  });

  it("disconnects", async () => {
    const res = await action({ request: form({ intent: "disconnect" }), params: {} } as any);
    expect(deleteConnection).toHaveBeenCalledWith("demo.myshopify.com");
    expect(res).toEqual({ ok: true });
  });

  it("tests a typed key without saving it", async () => {
    testConnection.mockResolvedValue({ ok: true, model: "claude-haiku-4-5" });
    const res: any = await action({ request: form({ intent: "test", provider: "anthropic", apiKey: "sk-9", model: "" }), params: {} } as any);
    expect(testConnection).toHaveBeenCalledWith({ provider: "anthropic", apiKey: "sk-9", model: null });
    expect(saveConnection).not.toHaveBeenCalled();
    expect(res).toMatchObject({ ok: true, tested: true, model: "claude-haiku-4-5" });
  });

  it("tests the saved connection when no key is typed", async () => {
    getCredential.mockResolvedValue({ provider: "openrouter", apiKey: "saved", model: null });
    testConnection.mockResolvedValue({ ok: true, model: "openai/gpt-4o-mini" });
    const res: any = await action({ request: form({ intent: "test", provider: "openrouter", apiKey: "" }), params: {} } as any);
    expect(getCredential).toHaveBeenCalledWith("demo.myshopify.com");
    expect(res.ok).toBe(true);
  });
});
