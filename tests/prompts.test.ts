import { describe, it, expect } from "vitest";
import { buildUserPrompt, SUGGESTION_SCHEMA, SYSTEM_PROMPT } from "../app/ai/prompts";
import { issue } from "../app/scoring/issues";
import { WEAK_PRODUCT } from "./fixtures";

const settings = { tonePreference: "premium", targetAudience: "parents", aiRule: "aggressive" };

describe("buildUserPrompt", () => {
  const prompt = buildUserPrompt(WEAK_PRODUCT, [issue("MISSING_SEO_DESCRIPTION")], settings);

  it("includes tone, audience, and rewrite-rule guidance", () => {
    expect(prompt).toMatch(/Refined and aspirational/i); // premium tone
    expect(prompt).toContain("parents");
    expect(prompt).toMatch(/Rewrite freely/i); // aggressive rule
  });

  it("lists the issues to address", () => {
    expect(prompt).toContain("SEO meta description is missing");
  });

  it("includes current product data and a JSON-shape instruction", () => {
    expect(prompt).toContain("Black Shirt");
    expect(prompt).toMatch(/JSON object/i);
    expect(prompt).toContain("descriptionHtml");
  });
});

describe("schema + system prompt", () => {
  it("schema requires all suggestion fields and forbids extras", () => {
    expect(SUGGESTION_SCHEMA.required).toEqual(
      expect.arrayContaining(["title", "descriptionHtml", "seoTitle", "seoDescription", "imageAlt", "tags", "category"]),
    );
    expect(SUGGESTION_SCHEMA.additionalProperties).toBe(false);
  });

  it("system prompt forbids inventing unsupported facts", () => {
    expect(SYSTEM_PROMPT).toMatch(/never invent/i);
  });
});
