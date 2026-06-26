import type { ProductInput, SubScore } from "./types";
import { issue } from "./issues";
import {
  stripHtml,
  containsAny,
  BENEFIT_WORDS,
  MATERIAL_WORDS,
  USE_CASE_WORDS,
  CARE_WARRANTY_WORDS,
} from "./text";

// Description Quality — 20 points (brief §17)
//  +5 explains what the product is
//  +5 explains benefits
//  +4 includes material/specification
//  +3 includes use case
//  +3 includes care/warranty/fit info
export function descriptionScore(product: ProductInput): SubScore {
  const max = 20;
  const text = stripHtml(product.descriptionHtml);
  const issues = [];
  let score = 0;

  if (!text) {
    issues.push(issue("DESCRIPTION_MISSING"));
    return { score: 0, max, issues };
  }

  const explains = text.length >= 50;
  const benefits = containsAny(text, BENEFIT_WORDS);
  const material = containsAny(text, MATERIAL_WORDS);
  const useCase = containsAny(text, USE_CASE_WORDS);
  const careInfo = containsAny(text, CARE_WARRANTY_WORDS);

  if (explains) score += 5;
  if (benefits) score += 5;
  if (material) score += 4;
  if (useCase) score += 3;
  if (careInfo) score += 3;

  if (!explains) {
    issues.push(issue("DESCRIPTION_TOO_SHORT"));
  } else if (!material || !useCase || !careInfo) {
    issues.push(issue("DESCRIPTION_MISSING_DETAILS"));
  }

  return { score, max, issues };
}
