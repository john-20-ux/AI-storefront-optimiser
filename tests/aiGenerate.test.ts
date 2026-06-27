import { describe, it, expect, vi, beforeEach } from "vitest";

const anthropicCreate = vi.fn();
const openaiCreate = vi.fn();

// Replace the SDK client factories; keep resolveModel real.
vi.mock("../app/ai/client", async (importActual) => {
  const actual = await importActual<typeof import("../app/ai/client")>();
  return {
    ...actual,
    anthropicClient: () => ({ messages: { create: anthropicCreate } }),
    openAiCompatibleClient: () => ({ chat: { completions: { create: openaiCreate } } }),
  };
});

import { generateFixes } from "../app/ai/generate";
import type { AiCredential } from "../app/lib/aiConnection.server";
import { WEAK_PRODUCT } from "./fixtures";

const settings = { tonePreference: "simple", targetAudience: "general", aiRule: "balanced" };
const SUGG = {
  title: "T",
  descriptionHtml: "<p>d</p>",
  seoTitle: "st",
  seoDescription: "sd",
  imageAlt: "alt",
  tags: ["x", "y"],
  category: "C",
};

beforeEach(() => {
  anthropicCreate.mockReset();
  openaiCreate.mockReset();
  anthropicCreate.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(SUGG) }] });
  openaiCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(SUGG) } }] });
});

const cred = (provider: AiCredential["provider"]): AiCredential => ({ provider, apiKey: "k", model: null });

describe("generateFixes dispatch", () => {
  it("uses the Anthropic SDK for the anthropic provider", async () => {
    const out = await generateFixes(WEAK_PRODUCT, [], settings, cred("anthropic"));
    expect(anthropicCreate).toHaveBeenCalledTimes(1);
    expect(openaiCreate).not.toHaveBeenCalled();
    expect(out).toMatchObject(SUGG);
  });

  it("uses the OpenAI-compatible client for openai and openrouter", async () => {
    await generateFixes(WEAK_PRODUCT, [], settings, cred("openai"));
    await generateFixes(WEAK_PRODUCT, [], settings, cred("openrouter"));
    expect(openaiCreate).toHaveBeenCalledTimes(2);
    expect(anthropicCreate).not.toHaveBeenCalled();
  });

  it("normalizes missing fields (tags defaults to [])", async () => {
    openaiCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ title: "only" }) } }] });
    const out = await generateFixes(WEAK_PRODUCT, [], settings, cred("openai"));
    expect(out.title).toBe("only");
    expect(out.tags).toEqual([]);
    expect(out.seoTitle).toBe("");
  });

  it("throws on an Anthropic refusal stop_reason", async () => {
    anthropicCreate.mockResolvedValueOnce({ stop_reason: "refusal", content: [] });
    await expect(generateFixes(WEAK_PRODUCT, [], settings, cred("anthropic"))).rejects.toThrow(/declined/i);
  });
});
