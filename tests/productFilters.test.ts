import { describe, it, expect } from "vitest";
import { matchesFilter, FILTERS, type FilterableRow } from "../app/lib/productFilters";

const row = (over: Partial<FilterableRow["flags"]> & { level?: string } = {}): FilterableRow => ({
  level: over.level ?? "good",
  flags: {
    missingSeo: false,
    missingAlt: false,
    missingCategory: false,
    weakDescription: false,
    variantIssues: false,
    ...over,
  },
});

describe("FILTERS", () => {
  it("exposes all 10 filter options including 'all'", () => {
    expect(FILTERS).toHaveLength(10);
    expect(FILTERS[0].key).toBe("all");
  });
});

describe("matchesFilter", () => {
  it("'all' matches everything", () => {
    expect(matchesFilter(row({ level: "critical" }), "all")).toBe(true);
  });

  it("level filters match the row level", () => {
    expect(matchesFilter(row({ level: "critical" }), "critical")).toBe(true);
    expect(matchesFilter(row({ level: "good" }), "critical")).toBe(false);
    expect(matchesFilter(row({ level: "excellent" }), "excellent")).toBe(true);
  });

  it("flag filters match the corresponding flag", () => {
    expect(matchesFilter(row({ missingSeo: true }), "missing_seo")).toBe(true);
    expect(matchesFilter(row({ missingAlt: true }), "missing_alt")).toBe(true);
    expect(matchesFilter(row({ missingCategory: true }), "missing_category")).toBe(true);
    expect(matchesFilter(row({ weakDescription: true }), "weak_description")).toBe(true);
    expect(matchesFilter(row({ variantIssues: true }), "variant_issues")).toBe(true);
  });

  it("flag filters reject rows without the flag", () => {
    expect(matchesFilter(row(), "missing_seo")).toBe(false);
    expect(matchesFilter(row(), "variant_issues")).toBe(false);
  });
});
