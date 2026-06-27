// Client-safe AI provider constants (no server-only imports), so route
// components can use them without pulling Prisma/crypto into the client bundle.

export const AI_PROVIDERS = ["anthropic", "openai", "openrouter"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  openrouter: "OpenRouter",
};

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && (AI_PROVIDERS as readonly string[]).includes(value);
}
