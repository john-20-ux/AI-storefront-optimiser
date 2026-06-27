import type { ProductInput, Issue } from "../scoring/types";
import type { AiCredential } from "../lib/aiConnection.server";
import { anthropicClient, openAiCompatibleClient, resolveModel } from "./client";
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

function normalize(raw: any): Suggestions {
  return {
    title: String(raw.title ?? ""),
    descriptionHtml: String(raw.descriptionHtml ?? ""),
    seoTitle: String(raw.seoTitle ?? ""),
    seoDescription: String(raw.seoDescription ?? ""),
    imageAlt: String(raw.imageAlt ?? ""),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    category: String(raw.category ?? ""),
  };
}

async function generateAnthropic(
  cred: AiCredential,
  userPrompt: string,
  model: string,
): Promise<Suggestions> {
  const client = anthropicClient(cred.apiKey);
  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: SUGGESTION_SCHEMA } },
    messages: [{ role: "user", content: userPrompt }],
  });
  if (response.stop_reason === "refusal") {
    throw new Error("The AI declined to generate suggestions for this product.");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("No suggestion content returned.");
  return normalize(JSON.parse(text.text));
}

async function generateOpenAiCompatible(
  cred: AiCredential,
  userPrompt: string,
  model: string,
): Promise<Suggestions> {
  const client = openAiCompatibleClient(cred);
  const response = await client.chat.completions.create({
    model,
    max_tokens: 1500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No suggestion content returned.");
  return normalize(JSON.parse(content));
}

/**
 * Generate field suggestions for a single product using the shop's own AI
 * credential. Rule-based scoring runs first elsewhere — this is called only when
 * a merchant explicitly requests fixes, keeping AI usage and cost low.
 */
export async function generateFixes(
  product: ProductInput,
  issues: Issue[],
  settings: ScanSettingsLike,
  cred: AiCredential,
): Promise<Suggestions> {
  const userPrompt = buildUserPrompt(product, issues, settings);
  const model = resolveModel(cred, settings.aiRule);
  if (cred.provider === "anthropic") {
    return generateAnthropic(cred, userPrompt, model);
  }
  return generateOpenAiCompatible(cred, userPrompt, model);
}
