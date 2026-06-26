// Shared product shape used by the fetch layer, scoring engine, and AI engine.
// This is the normalized input — mapped from the Shopify GraphQL response and
// held only in memory for the duration of a request (never persisted).

export interface VariantInput {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: string | null;
  compareAtPrice: string | null;
  selectedOptions: { name: string; value: string }[];
}

export interface MediaInput {
  id: string;
  alt: string | null;
  mediaContentType: string;
  previewImageUrl: string | null;
}

export interface OptionInput {
  name: string;
  values: string[];
}

export interface MetafieldInput {
  namespace: string;
  key: string;
  value: string;
}

export interface ProductInput {
  id: string;
  title: string;
  handle: string;
  status: string; // ACTIVE | DRAFT | ARCHIVED
  vendor: string | null;
  productType: string | null;
  tags: string[];
  descriptionHtml: string | null;
  category: { id: string; name: string } | null;
  seo: { title: string | null; description: string | null };
  onlineStoreUrl: string | null;
  totalInventory: number | null;
  featuredImageUrl: string | null;
  variants: VariantInput[];
  media: MediaInput[];
  options: OptionInput[];
  metafields: MetafieldInput[];
}

export type Severity = "high" | "medium" | "low";

export type ReadinessLevel = "critical" | "needs_work" | "good" | "excellent";

export interface Issue {
  code: string;
  severity: Severity;
  field: string;
  message: string;
  suggestedAction: string;
}

export interface SubScore {
  score: number;
  max: number;
  issues: Issue[];
}

export interface CategoryScore {
  key: string; // title | description | seo | image | taxonomy | variant | trust
  label: string;
  score: number;
  max: number;
}

export interface ScoreResult {
  productId: string;
  score: number; // 0-100
  level: ReadinessLevel;
  breakdown: CategoryScore[];
  issues: Issue[];
}
