import type { ProductInput } from "../app/scoring/types";

// Build a ProductInput with sensible empty defaults; override per test.
export function makeProduct(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    id: "gid://shopify/Product/1",
    title: "",
    handle: "",
    status: "ACTIVE",
    vendor: null,
    productType: null,
    tags: [],
    descriptionHtml: null,
    category: null,
    seo: { title: null, description: null },
    onlineStoreUrl: null,
    totalInventory: null,
    featuredImageUrl: null,
    variants: [],
    media: [],
    options: [],
    metafields: [],
    ...overrides,
  };
}

// A deliberately weak product — the kind that should score "Critical".
export const WEAK_PRODUCT: ProductInput = makeProduct({
  id: "gid://shopify/Product/weak",
  title: "Black Shirt",
  handle: "black-shirt",
  status: "ACTIVE",
  descriptionHtml: null,
  totalInventory: 0,
  variants: [
    {
      id: "v1",
      title: "Default Title",
      sku: null,
      barcode: null,
      price: "20.00",
      compareAtPrice: null,
      selectedOptions: [{ name: "Title", value: "Default Title" }],
    },
  ],
  options: [{ name: "Title", values: ["Default Title"] }],
});

// A strong, fully-optimized product — should score "Excellent" (100).
export const STRONG_PRODUCT: ProductInput = makeProduct({
  id: "gid://shopify/Product/strong",
  title: "Men's Black Cotton Casual Shirt",
  handle: "mens-black-cotton-casual-shirt",
  status: "ACTIVE",
  vendor: "Acme",
  productType: "Shirt",
  tags: ["shirt", "cotton", "casual", "mens"],
  descriptionHtml:
    "<p>This soft organic cotton shirt is breathable and comfortable. " +
    "Made of 100% cotton with regular-fit dimensions. Ideal for everyday office wear. " +
    "Machine wash cold; backed by a 1 year warranty.</p>",
  category: { id: "gid://shopify/TaxonomyCategory/aa-1", name: "Shirts" },
  seo: {
    title: "Men's Black Cotton Casual Shirt",
    description:
      "Shop our soft black cotton casual shirt for men — breathable, comfortable, and perfect for everyday office wear.",
  },
  totalInventory: 25,
  media: [
    {
      id: "m1",
      alt: "Men's black cotton casual shirt front view",
      mediaContentType: "IMAGE",
      previewImageUrl: "https://example.com/1.jpg",
    },
    {
      id: "m2",
      alt: "Men's black cotton casual shirt side view on model",
      mediaContentType: "IMAGE",
      previewImageUrl: "https://example.com/2.jpg",
    },
    {
      id: "m3",
      alt: "Men's black cotton casual shirt folded detail",
      mediaContentType: "IMAGE",
      previewImageUrl: "https://example.com/3.jpg",
    },
  ],
  options: [{ name: "Size", values: ["S", "M"] }],
  variants: [
    {
      id: "v1",
      title: "S",
      sku: "SHIRT-BLK-S",
      barcode: "0000000000017",
      price: "20.00",
      compareAtPrice: "30.00",
      selectedOptions: [{ name: "Size", value: "S" }],
    },
    {
      id: "v2",
      title: "M",
      sku: "SHIRT-BLK-M",
      barcode: "0000000000024",
      price: "20.00",
      compareAtPrice: "30.00",
      selectedOptions: [{ name: "Size", value: "M" }],
    },
  ],
});
