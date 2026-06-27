import type { ProductInput, Issue } from "../scoring/types";
import { stripHtml } from "../scoring/text";

export interface ScanSettingsLike {
  tonePreference: string;
  targetAudience: string;
  aiRule: string;
}

// JSON Schema for the structured-output response. All fields required so the
// merchant always gets a full set of suggestions to choose from.
export const SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Improved product title" },
    descriptionHtml: {
      type: "string",
      description: "Improved product description as simple HTML (<p>, <ul>, <li>)",
    },
    seoTitle: { type: "string", description: "Search-friendly SEO page title (<=60 chars)" },
    seoDescription: {
      type: "string",
      description: "SEO meta description, 150-160 characters",
    },
    imageAlt: {
      type: "string",
      description: "Descriptive alt text for the main product image",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "5-8 relevant lowercase tags",
    },
    category: {
      type: "string",
      description: "Suggested product category path, e.g. 'Baby & Toddler > Baby Bedding'",
    },
  },
  required: [
    "title",
    "descriptionHtml",
    "seoTitle",
    "seoDescription",
    "imageAlt",
    "tags",
    "category",
  ],
  additionalProperties: false,
} as const;

const TONE_GUIDANCE: Record<string, string> = {
  simple: "Clear, plain, easy to scan.",
  premium: "Refined and aspirational, emphasizing quality.",
  friendly: "Warm and conversational.",
  technical: "Precise, spec-forward, factual.",
  luxury: "Elegant and exclusive.",
  playful: "Light, fun, and energetic.",
};

const RULE_GUIDANCE: Record<string, string> = {
  conservative: "Stay very close to the existing wording; only fix clear gaps.",
  balanced: "Improve clarity and completeness while keeping the product's voice.",
  aggressive: "Rewrite freely for maximum clarity, SEO, and AI discoverability.",
};

export const SYSTEM_PROMPT =
  "You are a Shopify catalog optimization assistant. You improve product data so it is " +
  "easier to understand, discover, and recommend by AI shopping tools, search engines, and " +
  "customers. Never invent facts (materials, certifications, measurements) that are not " +
  "supported by the provided product data. Keep claims truthful and merchant-safe.";

export function buildUserPrompt(
  product: ProductInput,
  issues: Issue[],
  settings: ScanSettingsLike,
): string {
  const description = stripHtml(product.descriptionHtml) || "(none)";
  const tone = TONE_GUIDANCE[settings.tonePreference] ?? TONE_GUIDANCE.simple;
  const rule = RULE_GUIDANCE[settings.aiRule] ?? RULE_GUIDANCE.balanced;
  const issueLines = issues.length
    ? issues.map((i) => `- ${i.message} (${i.suggestedAction})`).join("\n")
    : "- General optimization for AI/search discovery.";

  return [
    `Tone: ${tone}`,
    `Target audience: ${settings.targetAudience}`,
    `Rewrite rule: ${rule}`,
    "",
    "Current product data:",
    `- Title: ${product.title || "(none)"}`,
    `- Type: ${product.productType || "(none)"} | Vendor: ${product.vendor || "(none)"}`,
    `- Category: ${product.category?.name || "(none)"}`,
    `- Tags: ${product.tags.length ? product.tags.join(", ") : "(none)"}`,
    `- SEO title: ${product.seo.title || "(none)"}`,
    `- SEO description: ${product.seo.description || "(none)"}`,
    `- Description: ${description}`,
    "",
    "Issues to address:",
    issueLines,
    "",
    "Produce improved values for every field. For the description, return simple HTML.",
  ].join("\n");
}
