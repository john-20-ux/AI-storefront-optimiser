import type { ProductInput, SubScore } from "./types";
import { issue } from "./issues";
import { words } from "./text";

// SEO Quality — 15 points (brief §17)
//  +5 SEO title exists
//  +5 SEO description exists
//  +3 handle is readable
//  +2 product title and SEO are aligned
export function seoScore(product: ProductInput): SubScore {
  const max = 15;
  const issues = [];
  let score = 0;

  const seoTitle = (product.seo.title ?? "").trim();
  const seoDescription = (product.seo.description ?? "").trim();
  const handle = (product.handle ?? "").trim();

  const hasTitle = seoTitle.length > 0;
  const hasDescription = seoDescription.length > 0;
  // Readable handle: lowercase words separated by hyphens, not purely numeric/random.
  const readableHandle =
    /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(handle) && /[a-z]/.test(handle);

  const titleWords = new Set(
    words((product.title ?? "").toLowerCase()).filter((w) => w.length > 3),
  );
  const seoTitleWords = words(seoTitle.toLowerCase());
  const aligned =
    hasTitle && seoTitleWords.some((w) => w.length > 3 && titleWords.has(w));

  if (hasTitle) score += 5;
  if (hasDescription) score += 5;
  if (readableHandle) score += 3;
  if (aligned) score += 2;

  if (!hasTitle) issues.push(issue("MISSING_SEO_TITLE"));
  if (!hasDescription) issues.push(issue("MISSING_SEO_DESCRIPTION"));
  if (!readableHandle) issues.push(issue("UNREADABLE_HANDLE"));

  return { score, max, issues };
}
