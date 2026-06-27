import { describe, it, expect } from "vitest";
import { resolveModel } from "../app/ai/client";
import type { AiCredential } from "../app/lib/aiConnection.server";

const cred = (provider: AiCredential["provider"], model: string | null = null): AiCredential => ({
  provider,
  apiKey: "test",
  model,
});

describe("resolveModel", () => {
  it("uses a custom model override when present", () => {
    expect(resolveModel(cred("anthropic", "claude-opus-4-8"), "balanced")).toBe("claude-opus-4-8");
    expect(resolveModel(cred("openrouter", "x/y-z"), "aggressive")).toBe("x/y-z");
  });

  it("picks the standard default for conservative/balanced", () => {
    expect(resolveModel(cred("anthropic"), "balanced")).toBe("claude-haiku-4-5");
    expect(resolveModel(cred("openai"), "conservative")).toBe("gpt-4o-mini");
    expect(resolveModel(cred("openrouter"), "balanced")).toBe("openai/gpt-4o-mini");
  });

  it("picks the aggressive default for aggressive", () => {
    expect(resolveModel(cred("anthropic"), "aggressive")).toBe("claude-sonnet-4-6");
    expect(resolveModel(cred("openai"), "aggressive")).toBe("gpt-4o");
  });

  it("treats a blank/whitespace model as no override", () => {
    expect(resolveModel(cred("anthropic", "   "), "balanced")).toBe("claude-haiku-4-5");
  });
});
