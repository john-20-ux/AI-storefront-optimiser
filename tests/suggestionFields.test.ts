import { describe, it, expect } from "vitest";
import {
  FIELD_ROWS,
  displaySuggestion,
  applyValue,
  type SuggestionFields,
} from "../app/lib/suggestionFields";

const SUGG: SuggestionFields = {
  title: "Men's Black Cotton Shirt",
  descriptionHtml: "<p>Soft <strong>cotton</strong> shirt.</p>",
  seoTitle: "Black Cotton Shirt",
  seoDescription: "A breathable black cotton shirt for everyday wear.",
  imageAlt: "Black cotton shirt front view",
  tags: ["shirt", "cotton", "black"],
  category: "Apparel > Shirts",
};

describe("FIELD_ROWS", () => {
  it("covers the six editable fields", () => {
    expect(FIELD_ROWS.map((f) => f.key)).toEqual([
      "title",
      "descriptionHtml",
      "seoTitle",
      "seoDescription",
      "tags",
      "imageAlt",
    ]);
  });
});

describe("displaySuggestion", () => {
  it("strips HTML from the description for display", () => {
    expect(displaySuggestion("descriptionHtml", SUGG)).toBe("Soft cotton shirt.");
  });
  it("joins tags with commas", () => {
    expect(displaySuggestion("tags", SUGG)).toBe("shirt, cotton, black");
  });
  it("returns plain fields as-is", () => {
    expect(displaySuggestion("title", SUGG)).toBe("Men's Black Cotton Shirt");
    expect(displaySuggestion("imageAlt", SUGG)).toBe("Black cotton shirt front view");
  });
});

describe("applyValue", () => {
  it("keeps raw HTML for the description (unlike display)", () => {
    expect(applyValue("descriptionHtml", SUGG)).toBe("<p>Soft <strong>cotton</strong> shirt.</p>");
  });
  it("matches displaySuggestion for non-HTML fields", () => {
    expect(applyValue("tags", SUGG)).toBe("shirt, cotton, black");
    expect(applyValue("seoTitle", SUGG)).toBe("Black Cotton Shirt");
  });
});
