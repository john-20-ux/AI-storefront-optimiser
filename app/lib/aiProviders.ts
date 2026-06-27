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

export interface ModelOption {
  value: string; // "" = use the default for the selected AI rule
  label: string;
}

export const CUSTOM_MODEL = "__custom__";

// Curated model choices per provider for the Settings dropdown. "" maps to the
// per-rule default; CUSTOM_MODEL reveals a free-text field for anything else
// (important for OpenRouter's large catalog).
export const PROVIDER_MODELS: Record<AiProvider, ModelOption[]> = {
  anthropic: [
    { value: "", label: "Default (by AI rule)" },
    { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 (fast)" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (quality)" },
    { value: "claude-opus-4-8", label: "Claude Opus 4.8 (max)" },
    { value: CUSTOM_MODEL, label: "Custom model ID…" },
  ],
  openai: [
    { value: "", label: "Default (by AI rule)" },
    { value: "gpt-4o-mini", label: "GPT-4o mini (fast)" },
    { value: "gpt-4o", label: "GPT-4o (quality)" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: CUSTOM_MODEL, label: "Custom model ID…" },
  ],
  openrouter: [
    { value: "", label: "Default (by AI rule)" },
    { value: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku" },
    { value: "anthropic/claude-3.7-sonnet", label: "Claude 3.7 Sonnet" },
    { value: "openai/gpt-4o-mini", label: "GPT-4o mini" },
    { value: "openai/gpt-4o", label: "GPT-4o" },
    { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
    { value: CUSTOM_MODEL, label: "Custom model ID…" },
  ],
};

// True when `model` is one of the provider's curated values (so the dropdown can
// preselect it); otherwise the UI shows it as a custom entry.
export function isKnownModel(provider: AiProvider, model: string): boolean {
  return PROVIDER_MODELS[provider].some((m) => m.value === model && m.value !== CUSTOM_MODEL);
}
