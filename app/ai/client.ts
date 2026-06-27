import Anthropic from "@anthropic-ai/sdk";

// Single shared client. Reads ANTHROPIC_API_KEY from the environment.
let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

// Haiku for cheap, high-volume generation; Sonnet for higher-quality rewrites.
export const MODELS = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-4-6",
} as const;

// Map the merchant's AI rule (Settings) to a model.
export function pickModel(aiRule: string): string {
  return aiRule === "aggressive" ? MODELS.sonnet : MODELS.haiku;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
