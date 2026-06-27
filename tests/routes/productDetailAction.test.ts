import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  authenticate,
  shopFindUnique,
  fetchProductById,
  generateFixes,
  applySelectedFixes,
  getCredential,
  getScanSettings,
} = vi.hoisted(() => ({
  authenticate: { admin: vi.fn() },
  shopFindUnique: vi.fn(),
  fetchProductById: vi.fn(),
  generateFixes: vi.fn(),
  applySelectedFixes: vi.fn(),
  getCredential: vi.fn(),
  getScanSettings: vi.fn(),
}));

vi.mock("../../app/shopify.server", () => ({ authenticate }));
vi.mock("../../app/db.server", () => ({ default: { shop: { findUnique: shopFindUnique } } }));
vi.mock("../../app/shopify/fetchProducts", () => ({ fetchProductById }));
vi.mock("../../app/ai/generate", () => ({ generateFixes }));
vi.mock("../../app/shopify/applyFixes.server", () => ({ applySelectedFixes }));
vi.mock("../../app/lib/aiConnection.server", async (importActual) => {
  const actual = await importActual<typeof import("../../app/lib/aiConnection.server")>();
  return { ...actual, getCredential, hasConnection: vi.fn() };
});
vi.mock("../../app/lib/shop.server", () => ({ getScanSettings }));

import { action } from "../../app/routes/app.products.$id";
import { WEAK_PRODUCT } from "../fixtures";

function form(fields: Record<string, string>) {
  return new Request("https://app.example.com/app/products/123", {
    method: "POST",
    body: new URLSearchParams(fields),
  });
}
const params = { id: "123" };

beforeEach(() => {
  vi.clearAllMocks();
  authenticate.admin.mockResolvedValue({ admin: {}, session: { shop: "demo.myshopify.com" } });
  getScanSettings.mockResolvedValue({ tonePreference: "simple", targetAudience: "general", aiRule: "balanced" });
});

describe("app.products.$id action — generate gating", () => {
  it("blocks generate on a free plan (no entitlement)", async () => {
    shopFindUnique.mockResolvedValue({ planName: "free" });
    const res: any = await action({ request: form({ intent: "generate" }), params } as any);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/upgrade/i);
    expect(getCredential).not.toHaveBeenCalled();
  });

  it("blocks generate when no AI provider is connected", async () => {
    shopFindUnique.mockResolvedValue({ planName: "growth" });
    getCredential.mockResolvedValue(null);
    const res: any = await action({ request: form({ intent: "generate" }), params } as any);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/connect an ai provider/i);
    expect(fetchProductById).not.toHaveBeenCalled();
  });

  it("generates when plan + connection allow it", async () => {
    shopFindUnique.mockResolvedValue({ planName: "growth" });
    getCredential.mockResolvedValue({ provider: "anthropic", apiKey: "k", model: null });
    fetchProductById.mockResolvedValue(WEAK_PRODUCT);
    const SUGG = { title: "T", descriptionHtml: "", seoTitle: "", seoDescription: "", imageAlt: "", tags: [], category: "" };
    generateFixes.mockResolvedValue(SUGG);
    const res: any = await action({ request: form({ intent: "generate" }), params } as any);
    expect(generateFixes).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ ok: true, kind: "generate", suggestions: SUGG });
  });
});

describe("app.products.$id action — apply gating", () => {
  it("blocks apply on a free plan", async () => {
    shopFindUnique.mockResolvedValue({ planName: "free" });
    const res: any = await action({ request: form({ intent: "apply", title: "X" }), params } as any);
    expect(res.ok).toBe(false);
    expect(applySelectedFixes).not.toHaveBeenCalled();
  });

  it("applies only the submitted fields on a paid plan", async () => {
    shopFindUnique.mockResolvedValue({ planName: "starter" });
    fetchProductById.mockResolvedValue(WEAK_PRODUCT);
    applySelectedFixes.mockResolvedValue({ appliedFields: ["title"], errors: [] });
    const res: any = await action({ request: form({ intent: "apply", title: "New Title" }), params } as any);
    expect(applySelectedFixes).toHaveBeenCalledTimes(1);
    const selection = applySelectedFixes.mock.calls[0][2];
    expect(selection).toEqual({ title: "New Title" }); // only the submitted field
    expect(res).toMatchObject({ ok: true, kind: "apply", appliedFields: ["title"] });
  });
});
