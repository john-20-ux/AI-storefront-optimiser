// Small, dependency-free text helpers shared by the rule-based scorers.

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

export function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
}

export function hasRepeatedWord(text: string, max = 2): boolean {
  const counts = new Map<string, number>();
  for (const w of words(text.toLowerCase())) {
    const n = (counts.get(w) ?? 0) + 1;
    counts.set(w, n);
    if (w.length > 2 && n > max) return true;
  }
  return false;
}

// Keyword banks used to detect description richness, trust signals, and
// descriptive titles. Intentionally broad — these are heuristics, not NLP.
export const DESCRIPTOR_WORDS = [
  // colors
  "black", "white", "blue", "red", "green", "pink", "grey", "gray", "beige",
  "cream", "navy", "brown", "purple", "yellow", "gold", "silver",
  // materials
  "cotton", "leather", "wool", "silk", "linen", "polyester", "denim",
  "stainless", "wooden", "metal", "ceramic", "organic", "bamboo",
  // audience / style
  "men", "men's", "women", "women's", "kids", "baby", "newborn", "unisex",
  "casual", "premium", "luxury", "slim", "classic",
];

export const BENEFIT_WORDS = [
  "soft", "comfortable", "durable", "easy", "perfect", "ideal", "breathable",
  "premium", "lightweight", "versatile", "stylish", "reliable", "gentle",
  "long-lasting", "high-quality", "eco-friendly", "waterproof",
];

export const MATERIAL_WORDS = [
  "material", "made from", "made of", "fabric", "cotton", "polyester",
  "leather", "wool", "stainless", "ceramic", "dimensions", "size", "weight",
  "cm", "inch", "inches", "gram", "ml", "litre", "liter", "specification",
];

export const USE_CASE_WORDS = [
  "ideal for", "perfect for", "great for", "suitable for", "use for", "for ",
  "occasion", "gift", "everyday", "nursery", "office", "travel", "outdoor",
  "summer", "winter", "workout", "home",
];

export const CARE_WARRANTY_WORDS = [
  "machine wash", "hand wash", "wash", "care", "warranty", "guarantee",
  "return", "fit", "size guide", "dry clean",
];
