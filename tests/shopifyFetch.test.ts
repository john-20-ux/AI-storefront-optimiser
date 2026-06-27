import { describe, it, expect, vi } from "vitest";
import { fetchProducts, fetchProductById } from "../app/shopify/fetchProducts";
import type { GraphqlClient } from "../app/shopify/fetchProducts";

function fakeAdmin(responses: any[]): GraphqlClient {
  let i = 0;
  return {
    graphql: vi.fn(async () => ({ json: async () => responses[Math.min(i++, responses.length - 1)] }) as any),
  };
}

function page(nodes: any[], hasNextPage = false, endCursor: string | null = null) {
  return {
    data: { products: { pageInfo: { hasNextPage, endCursor }, nodes } },
    extensions: {
      cost: { requestedQueryCost: 50, throttleStatus: { currentlyAvailable: 1000, maximumAvailable: 1000, restoreRate: 50 } },
    },
  };
}

const fullNode = {
  id: "gid://shopify/Product/100",
  title: "Test Product",
  handle: "test-product",
  status: "ACTIVE",
  vendor: "Acme",
  productType: "Shirt",
  tags: ["a", "b"],
  descriptionHtml: "<p>Hi</p>",
  onlineStoreUrl: "https://x/p",
  totalInventory: 5,
  category: { id: "cat1", name: "Shirts" },
  seo: { title: "T", description: "D" },
  featuredMedia: { preview: { image: { url: "https://img/feat.jpg" } } },
  options: [{ id: "o1", name: "Size", optionValues: [{ name: "S" }, { name: "M" }] }],
  media: {
    nodes: [
      { id: "m1", alt: "front", mediaContentType: "IMAGE", preview: { image: { url: "https://img/1.jpg" } } },
      { id: "v1", alt: null, mediaContentType: "VIDEO", preview: { image: { url: null } } },
    ],
  },
  variants: {
    nodes: [
      { id: "var1", title: "S", sku: "SKU-S", barcode: "111", price: "20.00", compareAtPrice: "30.00", selectedOptions: [{ name: "Size", value: "S" }] },
    ],
  },
  metafields: { nodes: [{ namespace: "custom", key: "material", value: "cotton" }] },
};

describe("fetchProducts", () => {
  it("paginates across pages and returns all products", async () => {
    const admin = fakeAdmin([
      page([{ ...fullNode, id: "gid://shopify/Product/1" }], true, "cursor1"),
      page([{ ...fullNode, id: "gid://shopify/Product/2" }], false, null),
    ]);
    const { products, scanned, truncatedAtLimit } = await fetchProducts(admin, 100);
    expect(products.map((p) => p.id)).toEqual(["gid://shopify/Product/1", "gid://shopify/Product/2"]);
    expect(scanned).toBe(2);
    expect(truncatedAtLimit).toBe(false);
    expect(admin.graphql).toHaveBeenCalledTimes(2);
  });

  it("stops at the plan limit and flags truncation", async () => {
    const admin = fakeAdmin([page([fullNode, { ...fullNode, id: "gid://shopify/Product/2" }], true, "c")]);
    const { products, truncatedAtLimit } = await fetchProducts(admin, 1);
    expect(products).toHaveLength(1);
    expect(truncatedAtLimit).toBe(true);
  });

  it("throws on GraphQL errors", async () => {
    const admin = fakeAdmin([{ errors: [{ message: "Throttled" }] }]);
    await expect(fetchProducts(admin, 100)).rejects.toThrow(/Throttled/);
  });

  it("maps GraphQL nodes to ProductInput (variants, IMAGE-only media, options, metafields)", async () => {
    const admin = fakeAdmin([page([fullNode], false)]);
    const { products } = await fetchProducts(admin, 100);
    const p = products[0];
    expect(p.title).toBe("Test Product");
    expect(p.category).toEqual({ id: "cat1", name: "Shirts" });
    expect(p.seo).toEqual({ title: "T", description: "D" });
    expect(p.featuredImageUrl).toBe("https://img/feat.jpg");
    expect(p.options).toEqual([{ name: "Size", values: ["S", "M"] }]);
    // media maps both nodes but image scorer later filters; mapping keeps types
    expect(p.media).toHaveLength(2);
    expect(p.media[0]).toMatchObject({ id: "m1", alt: "front", mediaContentType: "IMAGE" });
    expect(p.variants[0]).toMatchObject({ sku: "SKU-S", barcode: "111", compareAtPrice: "30.00" });
    expect(p.metafields).toEqual([{ namespace: "custom", key: "material", value: "cotton" }]);
  });
});

describe("fetchProductById", () => {
  it("returns a mapped product", async () => {
    const admin = fakeAdmin([{ data: { product: fullNode } }]);
    const p = await fetchProductById(admin, "gid://shopify/Product/100");
    expect(p?.id).toBe("gid://shopify/Product/100");
  });

  it("returns null when not found", async () => {
    const admin = fakeAdmin([{ data: { product: null } }]);
    expect(await fetchProductById(admin, "gid://shopify/Product/999")).toBeNull();
  });

  it("throws on errors", async () => {
    const admin = fakeAdmin([{ errors: [{ message: "boom" }] }]);
    await expect(fetchProductById(admin, "gid://x/1")).rejects.toThrow(/boom/);
  });
});
