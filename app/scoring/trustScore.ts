import type { ProductInput, SubScore } from "./types";
import { issue } from "./issues";
import {
  stripHtml,
  containsAny,
  MATERIAL_WORDS,
  CARE_WARRANTY_WORDS,
  USE_CASE_WORDS,
} from "./text";

const TRUST_METAFIELD_KEYS = [
  "material",
  "care",
  "care_instructions",
  "size",
  "size_guide",
  "ingredients",
  "warranty",
  "specification",
  "specs",
];

// Trust / Commercial Quality — 10 points (brief §17)
//  +3 material/specification available
//  +2 size/care/warranty info available
//  +2 compare-at price logic is clean
//  +2 active product has inventory
//  +1 product has clear use case
export function trustScore(product: ProductInput): SubScore {
  const max = 10;
  const issues = [];
  let score = 0;

  const text = stripHtml(product.descriptionHtml);
  const metafieldKeys = product.metafields.map((m) => m.key.toLowerCase());
  const hasTrustMetafield = (keys: string[]) =>
    metafieldKeys.some((k) => keys.some((target) => k.includes(target)));

  const hasMaterial =
    containsAny(text, MATERIAL_WORDS) || hasTrustMetafield(["material", "specification", "specs", "ingredients"]);
  const hasCareWarranty =
    containsAny(text, CARE_WARRANTY_WORDS) || hasTrustMetafield(["care", "warranty", "size"]);
  const hasUseCase = containsAny(text, USE_CASE_WORDS);

  // Compare-at price is clean when no variant has a compare-at price that is set
  // but not greater than the selling price.
  const cleanComparePrice = !product.variants.some((v) => {
    const compare = v.compareAtPrice ? parseFloat(v.compareAtPrice) : null;
    const price = v.price ? parseFloat(v.price) : null;
    return compare !== null && price !== null && compare > 0 && compare <= price;
  });

  const isActive = product.status === "ACTIVE";
  const hasInventory =
    !isActive || (product.totalInventory !== null && product.totalInventory > 0);

  if (hasMaterial) score += 3;
  if (hasCareWarranty) score += 2;
  if (cleanComparePrice) score += 2;
  if (hasInventory) score += 2;
  if (hasUseCase) score += 1;

  if (!hasMaterial) issues.push(issue("MISSING_MATERIAL"));
  if (!hasCareWarranty) issues.push(issue("MISSING_TRUST_INFO"));
  if (!cleanComparePrice) issues.push(issue("INVERTED_COMPARE_AT_PRICE"));
  if (!hasInventory) issues.push(issue("ACTIVE_NO_INVENTORY"));

  return { score, max, issues };
}
