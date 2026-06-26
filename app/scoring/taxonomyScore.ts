import type { ProductInput, SubScore } from "./types";
import { issue } from "./issues";

// Taxonomy Quality — 15 points (brief §17)
//  +8 Shopify product category assigned
//  +4 product type / vendor filled
//  +3 useful tags / metafields available
export function taxonomyScore(product: ProductInput): SubScore {
  const max = 15;
  const issues = [];
  let score = 0;

  const hasCategory = Boolean(product.category?.id);
  const hasTypeOrVendor =
    Boolean(product.productType?.trim()) || Boolean(product.vendor?.trim());
  const usefulTags = (product.tags?.length ?? 0) >= 3 || product.metafields.length >= 1;

  if (hasCategory) score += 8;
  if (hasTypeOrVendor) score += 4;
  if (usefulTags) score += 3;

  if (!hasCategory) issues.push(issue("MISSING_CATEGORY"));
  if (!hasTypeOrVendor) issues.push(issue("MISSING_PRODUCT_TYPE"));
  if (!usefulTags) issues.push(issue("MISSING_TAGS"));

  return { score, max, issues };
}
