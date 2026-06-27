import { describe, it, expect, vi } from "vitest";
import { applyProductUpdate, applyImageAlt } from "../app/shopify/mutations";
import { applySelectedFixes } from "../app/shopify/applyFixes.server";
import type { GraphqlClient } from "../app/shopify/fetchProducts";

function recordingAdmin(opts: { productErrors?: string[]; fileErrors?: string[]; topLevelErrors?: string[] } = {}) {
  const calls: { query: string; variables: any }[] = [];
  const admin: GraphqlClient = {
    graphql: vi.fn(async (query: string, o?: any) => {
      calls.push({ query, variables: o?.variables });
      const body = opts.topLevelErrors
        ? { errors: opts.topLevelErrors.map((m) => ({ message: m })) }
        : query.includes("productUpdate")
          ? { data: { productUpdate: { product: { id: "x" }, userErrors: (opts.productErrors ?? []).map((m) => ({ message: m })) } } }
          : { data: { fileUpdate: { files: [{ id: "m" }], userErrors: (opts.fileErrors ?? []).map((m) => ({ message: m })) } } };
      return { json: async () => body } as any;
    }),
  };
  return { admin, calls };
}

describe("applyProductUpdate", () => {
  it("sends only the provided fields (selected-fields-only)", async () => {
    const { admin, calls } = recordingAdmin();
    const errors = await applyProductUpdate(admin, "gid://shopify/Product/1", {
      title: "New",
      seoTitle: "SEO T",
    });
    expect(errors).toEqual([]);
    const product = calls[0].variables.product;
    expect(product).toEqual({ id: "gid://shopify/Product/1", title: "New", seo: { title: "SEO T" } });
    expect(product).not.toHaveProperty("descriptionHtml");
    expect(product).not.toHaveProperty("tags");
  });

  it("does nothing (no call) when only id would be sent", async () => {
    const { admin } = recordingAdmin();
    const errors = await applyProductUpdate(admin, "gid://shopify/Product/1", {});
    expect(errors).toEqual([]);
    expect(admin.graphql).not.toHaveBeenCalled();
  });

  it("surfaces userErrors and top-level GraphQL errors", async () => {
    const a = recordingAdmin({ productErrors: ["Title is invalid"] });
    expect(await applyProductUpdate(a.admin, "gid://x/1", { title: "x" })).toEqual(["Title is invalid"]);
    const b = recordingAdmin({ topLevelErrors: ["Throttled"] });
    expect(await applyProductUpdate(b.admin, "gid://x/1", { title: "x" })).toEqual(["Throttled"]);
  });
});

describe("applyImageAlt", () => {
  it("calls fileUpdate with the media id + alt", async () => {
    const { admin, calls } = recordingAdmin();
    const errors = await applyImageAlt(admin, "gid://shopify/MediaImage/9", "nice alt");
    expect(errors).toEqual([]);
    expect(calls[0].variables.files).toEqual([{ id: "gid://shopify/MediaImage/9", alt: "nice alt" }]);
  });
});

describe("applySelectedFixes", () => {
  it("splits tags, applies product fields, and reports applied keys", async () => {
    const { admin } = recordingAdmin();
    const res = await applySelectedFixes(admin, "gid://x/1", {
      title: "T",
      tags: "a, b , c",
      seoDescription: "desc",
    });
    expect(res.errors).toEqual([]);
    expect(res.appliedFields).toEqual(expect.arrayContaining(["title", "tags", "seoDescription"]));
  });

  it("updates image alt when a media id is supplied", async () => {
    const { admin, calls } = recordingAdmin();
    const res = await applySelectedFixes(admin, "gid://x/1", { imageAlt: "alt text" }, "gid://shopify/MediaImage/5");
    expect(res.errors).toEqual([]);
    expect(res.appliedFields).toContain("imageAlt");
    expect(calls.some((c) => c.query.includes("fileUpdate"))).toBe(true);
  });

  it("errors when imageAlt is requested but no image exists", async () => {
    const { admin } = recordingAdmin();
    const res = await applySelectedFixes(admin, "gid://x/1", { imageAlt: "alt" }, null);
    expect(res.errors[0]).toMatch(/no image/i);
    expect(res.appliedFields).not.toContain("imageAlt");
  });
});
