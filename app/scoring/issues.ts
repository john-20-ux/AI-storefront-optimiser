import type { Issue, Severity } from "./types";

// Central registry of every issue the rule-based engine can raise.
// Shape matches the brief §18 example output.

interface IssueDef {
  severity: Severity;
  field: string;
  message: string;
  suggestedAction: string;
}

export const ISSUE_DEFS = {
  TITLE_TOO_SHORT: {
    severity: "high",
    field: "title",
    message: "Product title is too short to clearly describe the product.",
    suggestedAction: "Add product type plus descriptive words (material, color, audience).",
  },
  TITLE_NOT_DESCRIPTIVE: {
    severity: "medium",
    field: "title",
    message: "Title lacks descriptive words buyers and AI tools rely on.",
    suggestedAction: "Include material, color, fit, or use case in the title.",
  },
  TITLE_KEYWORD_STUFFED: {
    severity: "low",
    field: "title",
    message: "Title looks keyword-stuffed or all caps.",
    suggestedAction: "Use natural, readable wording without repeated keywords.",
  },
  DESCRIPTION_MISSING: {
    severity: "high",
    field: "descriptionHtml",
    message: "Product has no description.",
    suggestedAction: "Write a description covering what it is, benefits, and use case.",
  },
  DESCRIPTION_TOO_SHORT: {
    severity: "high",
    field: "descriptionHtml",
    message: "Description is too short for buyers or AI tools to understand the product.",
    suggestedAction: "Expand with benefits, material/specs, use case, and care info.",
  },
  DESCRIPTION_MISSING_DETAILS: {
    severity: "medium",
    field: "descriptionHtml",
    message: "Description is missing material, use case, or care details.",
    suggestedAction: "Add material/specification, who it's for, and care or warranty info.",
  },
  MISSING_SEO_TITLE: {
    severity: "high",
    field: "seo.title",
    message: "SEO page title is missing.",
    suggestedAction: "Generate a search-friendly page title aligned with the product.",
  },
  MISSING_SEO_DESCRIPTION: {
    severity: "high",
    field: "seo.description",
    message: "SEO meta description is missing.",
    suggestedAction: "Generate a 150–160 character search-friendly meta description.",
  },
  UNREADABLE_HANDLE: {
    severity: "low",
    field: "handle",
    message: "URL handle is not human-readable.",
    suggestedAction: "Use a readable, hyphenated handle based on the product title.",
  },
  MISSING_IMAGES: {
    severity: "high",
    field: "media",
    message: "Product has no images.",
    suggestedAction: "Add at least 3 clear product images.",
  },
  FEW_IMAGES: {
    severity: "medium",
    field: "media",
    message: "Product has fewer than 3 images.",
    suggestedAction: "Add more images showing different angles and use.",
  },
  MISSING_IMAGE_ALT: {
    severity: "high",
    field: "media.alt",
    message: "One or more images are missing alt text.",
    suggestedAction: "Generate descriptive alt text for every image.",
  },
  WEAK_IMAGE_ALT: {
    severity: "low",
    field: "media.alt",
    message: "Image alt text is too short or duplicated.",
    suggestedAction: "Write unique alt text that clearly describes each image.",
  },
  MISSING_CATEGORY: {
    severity: "high",
    field: "category",
    message: "Product category is not assigned.",
    suggestedAction: "Assign the correct Shopify product category.",
  },
  MISSING_PRODUCT_TYPE: {
    severity: "medium",
    field: "productType",
    message: "Product type and vendor are not set.",
    suggestedAction: "Set product type and vendor for cleaner catalog structure.",
  },
  MISSING_TAGS: {
    severity: "medium",
    field: "tags",
    message: "Product has few or no tags or structured attributes.",
    suggestedAction: "Add relevant tags and structured metafields for filtering and AI.",
  },
  VARIANT_DEFAULT_TITLE: {
    severity: "medium",
    field: "variants",
    message: 'Variants still use the "Default Title" option.',
    suggestedAction: "Rename options so customers see clear, meaningful choices.",
  },
  UNCLEAR_OPTION_NAMES: {
    severity: "low",
    field: "options",
    message: "Variant option names are unclear.",
    suggestedAction: "Use descriptive option names (e.g. Size, Color, Material).",
  },
  MISSING_SKU: {
    severity: "medium",
    field: "variants.sku",
    message: "One or more variants are missing a SKU.",
    suggestedAction: "Add SKUs to support operations and inventory.",
  },
  MISSING_BARCODE: {
    severity: "low",
    field: "variants.barcode",
    message: "Variants are missing barcodes.",
    suggestedAction: "Add barcodes (UPC/EAN) where applicable.",
  },
  MISSING_MATERIAL: {
    severity: "medium",
    field: "trust",
    message: "No material or specification information found.",
    suggestedAction: "Add material/specification details buyers and AI tools expect.",
  },
  MISSING_TRUST_INFO: {
    severity: "low",
    field: "trust",
    message: "Missing size, care, or warranty information.",
    suggestedAction: "Add size guide, care instructions, or warranty details.",
  },
  INVERTED_COMPARE_AT_PRICE: {
    severity: "medium",
    field: "variants.compareAtPrice",
    message: "Compare-at price is not higher than the selling price.",
    suggestedAction: "Fix compare-at price so the discount displays correctly.",
  },
  ACTIVE_NO_INVENTORY: {
    severity: "medium",
    field: "totalInventory",
    message: "Active product has no available inventory.",
    suggestedAction: "Restock or set the product to draft until available.",
  },
} satisfies Record<string, IssueDef>;

export type IssueCode = keyof typeof ISSUE_DEFS;

export function issue(code: IssueCode): Issue {
  const def = ISSUE_DEFS[code];
  return { code, ...def };
}
