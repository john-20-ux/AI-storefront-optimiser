// Pure filtering logic for the products table (extracted from the route so it
// can be unit-tested without rendering Polaris web components).

export type FilterKey =
  | "all"
  | "critical"
  | "needs_work"
  | "good"
  | "excellent"
  | "missing_seo"
  | "missing_alt"
  | "missing_category"
  | "weak_description"
  | "variant_issues";

export const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All products" },
  { key: "critical", label: "Critical" },
  { key: "needs_work", label: "Needs Work" },
  { key: "good", label: "Good" },
  { key: "excellent", label: "Excellent" },
  { key: "missing_seo", label: "Missing SEO" },
  { key: "missing_alt", label: "Missing alt text" },
  { key: "missing_category", label: "Missing category" },
  { key: "weak_description", label: "Weak description" },
  { key: "variant_issues", label: "Variant issues" },
];

// Minimal shape needed for filtering — ProductRow satisfies this structurally.
export interface FilterableRow {
  level: string;
  flags: {
    missingSeo: boolean;
    missingAlt: boolean;
    missingCategory: boolean;
    weakDescription: boolean;
    variantIssues: boolean;
  };
}

export function matchesFilter(row: FilterableRow, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "critical":
    case "needs_work":
    case "good":
    case "excellent":
      return row.level === filter;
    case "missing_seo":
      return row.flags.missingSeo;
    case "missing_alt":
      return row.flags.missingAlt;
    case "missing_category":
      return row.flags.missingCategory;
    case "weak_description":
      return row.flags.weakDescription;
    case "variant_issues":
      return row.flags.variantIssues;
  }
}
