import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AiCredential, AiProvider } from "../lib/aiConnection.server";

// Default models per provider, by AI rule. Merchants can override via the
// connection's `model` field.
const DEFAULT_MODELS: Record<AiProvider, { standard: string; aggressive: string }> = {
  anthropic: { standard: "claude-haiku-4-5", aggressive: "claude-sonnet-4-6" },
  openai: { standard: "gpt-4o-mini", aggressive: "gpt-4o" },
  openrouter: { standard: "openai/gpt-4o-mini", aggressive: "openai/gpt-4o" },
};

export function resolveModel(cred: AiCredential, aiRule: string): string {
  if (cred.model && cred.model.trim()) return cred.model.trim();
  const defaults = DEFAULT_MODELS[cred.provider];
  return aiRule === "aggressive" ? defaults.aggressive : defaults.standard;
}

export function anthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

// OpenAI SDK works for both OpenAI and OpenRouter (OpenAI-compatible API).
export function openAiCompatibleClient(cred: AiCredential): OpenAI {
  if (cred.provider === "openrouter") {
    return new OpenAI({
      apiKey: cred.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "X-Title": "AI Storefront Optimizer" },
    });
  }
  return new OpenAI({ apiKey: cred.apiKey });
}
