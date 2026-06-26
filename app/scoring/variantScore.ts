import type { ProductInput, SubScore } from "./types";
import { issue } from "./issues";

// Variant Quality — 10 points (brief §17)
//  +3 no "Default Title" issue
//  +3 option names are clear
//  +2 SKU exists
//  +2 barcode exists if needed
export function variantScore(product: ProductInput): SubScore {
  const max = 10;
  const issues = [];
  let score = 0;

  const variants = product.variants;
  const options = product.options;
  const isSingleVariant = variants.length <= 1;

  // A single-variant product legitimately uses the implicit "Default Title"; only
  // multi-variant products with a stray Default Title value are misconfigured.
  const hasDefaultTitleProblem =
    !isSingleVariant &&
    variants.some((v) => v.selectedOptions.some((o) => o.value === "Default Title"));

  // Option names are "clear" when there are real, non-default option names — or
  // when the product simply has no variant options.
  const realOptions = options.filter((o) => o.name && o.name !== "Title");
  const clearOptionNames = isSingleVariant || realOptions.length > 0;

  const allHaveSku = variants.length > 0 && variants.every((v) => Boolean(v.sku?.trim()));
  const allHaveBarcode =
    variants.length > 0 && variants.every((v) => Boolean(v.barcode?.trim()));

  if (!hasDefaultTitleProblem) score += 3;
  if (clearOptionNames) score += 3;
  if (allHaveSku) score += 2;
  if (allHaveBarcode) score += 2;

  if (hasDefaultTitleProblem) issues.push(issue("VARIANT_DEFAULT_TITLE"));
  if (!clearOptionNames) issues.push(issue("UNCLEAR_OPTION_NAMES"));
  if (!allHaveSku) issues.push(issue("MISSING_SKU"));
  if (!allHaveBarcode) issues.push(issue("MISSING_BARCODE"));

  return { score, max, issues };
}
