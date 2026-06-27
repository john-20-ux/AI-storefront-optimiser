import { describe, it, expect } from "vitest";
import {
  AI_PROVIDERS,
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  CUSTOM_MODEL,
  isAiProvider,
  isKnownModel,
} from "../app/lib/aiProviders";

describe("isAiProvider", () => {
  it("accepts the three providers and rejects others", () => {
    expect(isAiProvider("anthropic")).toBe(true);
    expect(isAiProvider("openai")).toBe(true);
    expect(isAiProvider("openrouter")).toBe(true);
    expect(isAiProvider("gemini")).toBe(false);
    expect(isAiProvider(null)).toBe(false);
    expect(isAiProvider(123)).toBe(false);
  });
});

describe("provider model lists", () => {
  it("every provider has a label and model options", () => {
    for (const p of AI_PROVIDERS) {
      expect(PROVIDER_LABELS[p]).toBeTruthy();
      const models = PROVIDER_MODELS[p];
      expect(models.length).toBeGreaterThan(1);
      // Always includes the default ("") and a custom escape hatch.
      expect(models.some((m) => m.value === "")).toBe(true);
      expect(models.some((m) => m.value === CUSTOM_MODEL)).toBe(true);
    }
  });
});

describe("isKnownModel", () => {
  it("recognizes curated models and the default, not custom/unknown", () => {
    expect(isKnownModel("anthropic", "claude-haiku-4-5")).toBe(true);
    expect(isKnownModel("anthropic", "")).toBe(true); // default
    expect(isKnownModel("anthropic", CUSTOM_MODEL)).toBe(false);
    expect(isKnownModel("openrouter", "some/unlisted-model")).toBe(false);
  });
});
