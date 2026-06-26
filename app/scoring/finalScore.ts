import type {
  ProductInput,
  ScoreResult,
  ReadinessLevel,
  Issue,
  Severity,
} from "./types";
import { titleScore } from "./titleScore";
import { descriptionScore } from "./descriptionScore";
import { seoScore } from "./seoScore";
import { imageScore } from "./imageScore";
import { taxonomyScore } from "./taxonomyScore";
import { variantScore } from "./variantScore";
import { trustScore } from "./trustScore";

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function levelFor(score: number): ReadinessLevel {
  if (score < 50) return "critical";
  if (score < 75) return "needs_work";
  if (score < 90) return "good";
  return "excellent";
}

export const LEVEL_LABELS: Record<ReadinessLevel, string> = {
  critical: "Critical",
  needs_work: "Needs Work",
  good: "Good",
  excellent: "Excellent",
};

/**
 * Score a single product across all seven dimensions (brief §17).
 * Pure function — deterministic, no I/O. Heavily unit-tested.
 */
export function scoreProduct(product: ProductInput): ScoreResult {
  const parts = [
    { key: "title", label: "Title quality", sub: titleScore(product) },
    { key: "description", label: "Description quality", sub: descriptionScore(product) },
    { key: "seo", label: "SEO quality", sub: seoScore(product) },
    { key: "image", label: "Image quality", sub: imageScore(product) },
    { key: "taxonomy", label: "Taxonomy quality", sub: taxonomyScore(product) },
    { key: "variant", label: "Variant quality", sub: variantScore(product) },
    { key: "trust", label: "Trust & commercial", sub: trustScore(product) },
  ];

  const score = parts.reduce((sum, p) => sum + p.sub.score, 0);
  const breakdown = parts.map((p) => ({
    key: p.key,
    label: p.label,
    score: p.sub.score,
    max: p.sub.max,
  }));
  const issues = parts
    .flatMap((p) => p.sub.issues)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return {
    productId: product.id,
    score,
    level: levelFor(score),
    breakdown,
    issues,
  };
}

export function mainIssue(result: ScoreResult): Issue | null {
  return result.issues[0] ?? null;
}

export interface CatalogScan {
  results: ScoreResult[];
  averageScore: number;
  issueCounts: {
    critical: number;
    missingSeo: number;
    missingAlt: number;
    missingCategory: number;
    weakDescription: number;
    variantIssues: number;
  };
}

const has = (r: ScoreResult, ...codes: string[]) =>
  r.issues.some((i) => codes.includes(i.code));

/**
 * Score a whole catalog and roll up the aggregates persisted on ScanSummary.
 */
export function scoreCatalog(products: ProductInput[]): CatalogScan {
  const results = products.map(scoreProduct);
  const averageScore = results.length
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0;

  const issueCounts = {
    critical: results.filter((r) => r.level === "critical").length,
    missingSeo: results.filter((r) =>
      has(r, "MISSING_SEO_TITLE", "MISSING_SEO_DESCRIPTION"),
    ).length,
    missingAlt: results.filter((r) => has(r, "MISSING_IMAGE_ALT", "MISSING_IMAGES")).length,
    missingCategory: results.filter((r) => has(r, "MISSING_CATEGORY")).length,
    weakDescription: results.filter((r) =>
      has(r, "DESCRIPTION_MISSING", "DESCRIPTION_TOO_SHORT", "DESCRIPTION_MISSING_DETAILS"),
    ).length,
    variantIssues: results.filter((r) =>
      has(r, "VARIANT_DEFAULT_TITLE", "UNCLEAR_OPTION_NAMES", "MISSING_SKU", "MISSING_BARCODE"),
    ).length,
  };

  return { results, averageScore, issueCounts };
}
