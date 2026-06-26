import { describe, it, expect } from "vitest";
import { titleScore } from "../app/scoring/titleScore";
import { descriptionScore } from "../app/scoring/descriptionScore";
import { seoScore } from "../app/scoring/seoScore";
import { imageScore } from "../app/scoring/imageScore";
import { taxonomyScore } from "../app/scoring/taxonomyScore";
import { variantScore } from "../app/scoring/variantScore";
import { trustScore } from "../app/scoring/trustScore";
import { scoreProduct, scoreCatalog, levelFor } from "../app/scoring/finalScore";
import { makeProduct, WEAK_PRODUCT, STRONG_PRODUCT } from "./fixtures";

describe("levelFor", () => {
  it("maps scores to readiness bands", () => {
    expect(levelFor(0)).toBe("critical");
    expect(levelFor(49)).toBe("critical");
    expect(levelFor(50)).toBe("needs_work");
    expect(levelFor(74)).toBe("needs_work");
    expect(levelFor(75)).toBe("good");
    expect(levelFor(89)).toBe("good");
    expect(levelFor(90)).toBe("excellent");
    expect(levelFor(100)).toBe("excellent");
  });
});

describe("titleScore", () => {
  it('scores a weak title ("Black Shirt") low', () => {
    const { score } = titleScore(WEAK_PRODUCT);
    expect(score).toBeLessThan(10);
  });

  it('gives a descriptive title ("Men\'s Black Cotton Casual Shirt") full marks', () => {
    const { score, max, issues } = titleScore(STRONG_PRODUCT);
    expect(score).toBe(max);
    expect(issues).toHaveLength(0);
  });

  it("flags keyword-stuffed / all-caps titles", () => {
    const { issues } = titleScore(
      makeProduct({ title: "SHIRT SHIRT SHIRT SHIRT SHIRT" }),
    );
    expect(issues.map((i) => i.code)).toContain("TITLE_KEYWORD_STUFFED");
  });
});

describe("descriptionScore", () => {
  it("returns 0 and a missing issue when there is no description", () => {
    const { score, issues } = descriptionScore(makeProduct());
    expect(score).toBe(0);
    expect(issues.map((i) => i.code)).toContain("DESCRIPTION_MISSING");
  });

  it("awards full marks to a rich description", () => {
    const { score, max } = descriptionScore(STRONG_PRODUCT);
    expect(score).toBe(max);
  });
});

describe("seoScore", () => {
  it("flags missing SEO title and description", () => {
    const codes = seoScore(WEAK_PRODUCT).issues.map((i) => i.code);
    expect(codes).toContain("MISSING_SEO_TITLE");
    expect(codes).toContain("MISSING_SEO_DESCRIPTION");
  });

  it("gives aligned, complete SEO full marks", () => {
    const { score, max } = seoScore(STRONG_PRODUCT);
    expect(score).toBe(max);
  });
});

describe("imageScore", () => {
  it("returns 0 and MISSING_IMAGES when there are no images", () => {
    const { score, issues } = imageScore(WEAK_PRODUCT);
    expect(score).toBe(0);
    expect(issues.map((i) => i.code)).toContain("MISSING_IMAGES");
  });

  it("flags missing alt text", () => {
    const product = makeProduct({
      media: [
        { id: "m1", alt: "", mediaContentType: "IMAGE", previewImageUrl: null },
        { id: "m2", alt: "", mediaContentType: "IMAGE", previewImageUrl: null },
        { id: "m3", alt: "", mediaContentType: "IMAGE", previewImageUrl: null },
      ],
    });
    expect(imageScore(product).issues.map((i) => i.code)).toContain("MISSING_IMAGE_ALT");
  });

  it("gives 3 well-described unique images full marks", () => {
    const { score, max } = imageScore(STRONG_PRODUCT);
    expect(score).toBe(max);
  });
});

describe("taxonomyScore", () => {
  it("flags missing category for the weak product", () => {
    expect(taxonomyScore(WEAK_PRODUCT).issues.map((i) => i.code)).toContain(
      "MISSING_CATEGORY",
    );
  });

  it("gives full marks with category, type, and tags", () => {
    const { score, max } = taxonomyScore(STRONG_PRODUCT);
    expect(score).toBe(max);
  });
});

describe("variantScore", () => {
  it("does not penalize a single-variant product for Default Title", () => {
    const { issues } = variantScore(WEAK_PRODUCT);
    expect(issues.map((i) => i.code)).not.toContain("VARIANT_DEFAULT_TITLE");
    // ...but it should flag the missing SKU.
    expect(issues.map((i) => i.code)).toContain("MISSING_SKU");
  });

  it("flags a multi-variant product still using Default Title", () => {
    const product = makeProduct({
      options: [{ name: "Title", values: ["Default Title"] }],
      variants: [
        {
          id: "v1",
          title: "Default Title",
          sku: "A",
          barcode: "1",
          price: "1",
          compareAtPrice: null,
          selectedOptions: [{ name: "Title", value: "Default Title" }],
        },
        {
          id: "v2",
          title: "Default Title",
          sku: "B",
          barcode: "2",
          price: "1",
          compareAtPrice: null,
          selectedOptions: [{ name: "Title", value: "Default Title" }],
        },
      ],
    });
    expect(variantScore(product).issues.map((i) => i.code)).toContain(
      "VARIANT_DEFAULT_TITLE",
    );
  });

  it("gives clean multi-variant products full marks", () => {
    const { score, max } = variantScore(STRONG_PRODUCT);
    expect(score).toBe(max);
  });
});

describe("trustScore", () => {
  it("flags an active product with no inventory", () => {
    expect(trustScore(WEAK_PRODUCT).issues.map((i) => i.code)).toContain(
      "ACTIVE_NO_INVENTORY",
    );
  });

  it("flags an inverted compare-at price", () => {
    const product = makeProduct({
      descriptionHtml: STRONG_PRODUCT.descriptionHtml,
      totalInventory: 5,
      variants: [
        {
          id: "v1",
          title: "S",
          sku: "A",
          barcode: "1",
          price: "30.00",
          compareAtPrice: "20.00", // lower than price — inverted
          selectedOptions: [{ name: "Size", value: "S" }],
        },
      ],
    });
    expect(trustScore(product).issues.map((i) => i.code)).toContain(
      "INVERTED_COMPARE_AT_PRICE",
    );
  });

  it("gives a complete product full marks", () => {
    const { score, max } = trustScore(STRONG_PRODUCT);
    expect(score).toBe(max);
  });
});

describe("scoreProduct", () => {
  it("rates the weak product Critical", () => {
    const result = scoreProduct(WEAK_PRODUCT);
    expect(result.score).toBeLessThan(50);
    expect(result.level).toBe("critical");
    expect(result.issues.length).toBeGreaterThan(0);
    // Issues are sorted highest-severity first.
    expect(result.issues[0].severity).toBe("high");
  });

  it("rates the strong product Excellent with a perfect score", () => {
    const result = scoreProduct(STRONG_PRODUCT);
    expect(result.score).toBe(100);
    expect(result.level).toBe("excellent");
    expect(result.issues).toHaveLength(0);
  });

  it("breakdown sums to the total score and caps at 100", () => {
    const result = scoreProduct(STRONG_PRODUCT);
    const sum = result.breakdown.reduce((s, b) => s + b.score, 0);
    expect(sum).toBe(result.score);
    const maxSum = result.breakdown.reduce((s, b) => s + b.max, 0);
    expect(maxSum).toBe(100);
  });
});

describe("scoreCatalog", () => {
  it("aggregates average score and issue counts", () => {
    const scan = scoreCatalog([WEAK_PRODUCT, STRONG_PRODUCT]);
    expect(scan.results).toHaveLength(2);
    expect(scan.averageScore).toBeGreaterThan(0);
    expect(scan.averageScore).toBeLessThan(100);
    expect(scan.issueCounts.critical).toBe(1);
    expect(scan.issueCounts.missingSeo).toBe(1);
    expect(scan.issueCounts.missingCategory).toBe(1);
  });

  it("handles an empty catalog", () => {
    const scan = scoreCatalog([]);
    expect(scan.averageScore).toBe(0);
    expect(scan.results).toHaveLength(0);
  });
});
