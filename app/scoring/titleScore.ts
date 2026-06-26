import type { ProductInput, SubScore } from "./types";
import { issue } from "./issues";
import { containsAny, hasRepeatedWord, isAllCaps, words, DESCRIPTOR_WORDS } from "./text";

// Title Quality — 15 points (brief §17)
//  +5 product type is clear
//  +5 title has descriptive words
//  +3 title is not too short
//  +2 title is not keyword-stuffed
export function titleScore(product: ProductInput): SubScore {
  const max = 15;
  const title = (product.title ?? "").trim();
  const tokens = words(title);
  const issues = [];
  let score = 0;

  const clearType = tokens.length >= 2 && title.length >= 8;
  const descriptive =
    tokens.length >= 5 || (tokens.length >= 3 && containsAny(title, DESCRIPTOR_WORDS));
  const notTooShort = title.length >= 20;
  const notStuffed = !isAllCaps(title) && tokens.length <= 12 && !hasRepeatedWord(title);

  if (clearType) score += 5;
  if (descriptive) score += 5;
  if (notTooShort) score += 3;
  if (notStuffed) score += 2;

  if (!clearType || !notTooShort) issues.push(issue("TITLE_TOO_SHORT"));
  if (!descriptive && (clearType || notTooShort)) issues.push(issue("TITLE_NOT_DESCRIPTIVE"));
  if (!notStuffed) issues.push(issue("TITLE_KEYWORD_STUFFED"));

  return { score, max, issues };
}
