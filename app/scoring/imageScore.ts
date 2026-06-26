import type { ProductInput, SubScore } from "./types";
import { issue } from "./issues";

// Image Quality — 15 points (brief §17)
//  +5 product has at least 3 images
//  +5 images have alt text
//  +3 alt text describes product clearly
//  +2 no duplicate or empty alt text
export function imageScore(product: ProductInput): SubScore {
  const max = 15;
  const issues = [];
  let score = 0;

  const images = product.media.filter((m) => m.mediaContentType === "IMAGE");

  if (images.length === 0) {
    issues.push(issue("MISSING_IMAGES"));
    return { score: 0, max, issues };
  }

  const alts = images.map((m) => (m.alt ?? "").trim());
  const allHaveAlt = alts.every((a) => a.length > 0);
  const descriptiveAlt = alts.some((a) => a.length >= 15);
  const nonEmpty = alts.filter((a) => a.length > 0);
  const noDuplicates =
    allHaveAlt && new Set(nonEmpty.map((a) => a.toLowerCase())).size === nonEmpty.length;

  if (images.length >= 3) score += 5;
  if (allHaveAlt) score += 5;
  if (descriptiveAlt) score += 3;
  if (noDuplicates) score += 2;

  if (images.length < 3) issues.push(issue("FEW_IMAGES"));
  if (!allHaveAlt) issues.push(issue("MISSING_IMAGE_ALT"));
  else if (!descriptiveAlt || !noDuplicates) issues.push(issue("WEAK_IMAGE_ALT"));

  return { score, max, issues };
}
