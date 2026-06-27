import type { ProductInput, Issue } from "../scoring/types";
import { getAnthropic, pickModel } from "./client";
import {
  SYSTEM_PROMPT,
  SUGGESTION_SCHEMA,
  buildUserPrompt,
  type ScanSettingsLike,
} from "./prompts";

export interface Suggestions {
  title: string;
  descriptionHtml: string;
  seoTitle: string;
  seoDescription: string;
  imageAlt: string;
  tags: string[];
  category: string;
}

/**
 * Generate field suggestions for a single product via Claude.
 * Rule-based scoring runs first elsewhere — this is called only when a merchant
 * explicitly requests fixes, keeping AI usage and cost low (brief §19/§28).
 */
export async function generateFixes(
  product: ProductInput,
  issues: Issue[],
  settings: ScanSettingsLike,
): Promise<Suggestions> {
  const client = getAnthropic();

  const response = await client.messages.create({
    model: pickModel(settings.aiRule),
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: SUGGESTION_SCHEMA } },
    messages: [{ role: "user", content: buildUserPrompt(product, issues, settings) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The AI declined to generate suggestions for this product.");
  }

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("No suggestion content returned.");
  }

  return JSON.parse(text.text) as Suggestions;
}
