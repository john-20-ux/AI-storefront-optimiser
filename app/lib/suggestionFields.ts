import { stripHtml } from "../scoring/text";

// The fields shown in the product before/after table, and how a generated
// suggestion maps to display text vs the raw value to apply. Extracted from the
// route for unit testing.

export const FIELD_ROWS = [
  { key: "title", label: "Title" },
  { key: "descriptionHtml", label: "Description" },
  { key: "seoTitle", label: "SEO title" },
  { key: "seoDescription", label: "SEO meta description" },
  { key: "tags", label: "Tags" },
  { key: "imageAlt", label: "Image alt text" },
] as const;

export type FieldKey = (typeof FIELD_ROWS)[number]["key"];

export interface SuggestionFields {
  title: string;
  descriptionHtml: string;
  seoTitle: string;
  seoDescription: string;
  imageAlt: string;
  tags: string[];
  category: string;
}

// Value shown in the "suggested" column (description stripped of HTML).
export function displaySuggestion(key: FieldKey, s: SuggestionFields): string {
  switch (key) {
    case "title":
      return s.title;
    case "descriptionHtml":
      return stripHtml(s.descriptionHtml);
    case "seoTitle":
      return s.seoTitle;
    case "seoDescription":
      return s.seoDescription;
    case "tags":
      return s.tags.join(", ");
    case "imageAlt":
      return s.imageAlt;
  }
}

// Raw value submitted on apply (description keeps its HTML).
export function applyValue(key: FieldKey, s: SuggestionFields): string {
  return key === "descriptionHtml" ? s.descriptionHtml : displaySuggestion(key, s);
}
