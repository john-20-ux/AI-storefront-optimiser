import type { GraphqlClient } from "../shopify/fetchProducts";
import { fetchProducts } from "../shopify/fetchProducts";
import { scoreCatalog, mainIssue, LEVEL_LABELS } from "./finalScore";
import type { ReadinessLevel } from "./types";
import { saveScanSummary } from "../lib/shop.server";

export interface ProductRow {
  id: string; // full gid
  numericId: string; // trailing id, used in URLs
  title: string;
  image: string | null;
  status: string;
  score: number;
  level: ReadinessLevel;
  levelLabel: string;
  mainIssue: string | null;
  issueCount: number;
  flags: {
    missingSeo: boolean;
    missingAlt: boolean;
    missingCategory: boolean;
    weakDescription: boolean;
    variantIssues: boolean;
  };
}

export interface ScanResult {
  rows: ProductRow[];
  scanned: number;
  averageScore: number;
  truncatedAtLimit: boolean;
}

const numericId = (gid: string) => gid.split("/").pop() ?? gid;
const has = (codes: string[], targets: string[]) => codes.some((c) => targets.includes(c));

/**
 * Run a full catalog scan: fetch (on demand) → score → persist aggregates only.
 * Returns lightweight rows for the issues table. No product data is stored.
 */
export async function runScan(
  admin: GraphqlClient,
  shopDomain: string,
  limit: number,
): Promise<ScanResult> {
  const { products, scanned, truncatedAtLimit } = await fetchProducts(admin, limit);
  const scan = scoreCatalog(products);

  const rows: ProductRow[] = products.map((product, i) => {
    const result = scan.results[i];
    const codes = result.issues.map((issue) => issue.code);
    const main = mainIssue(result);
    return {
      id: product.id,
      numericId: numericId(product.id),
      title: product.title || "(untitled product)",
      image: product.featuredImageUrl,
      status: product.status,
      score: result.score,
      level: result.level,
      levelLabel: LEVEL_LABELS[result.level],
      mainIssue: main?.message ?? null,
      issueCount: result.issues.length,
      flags: {
        missingSeo: has(codes, ["MISSING_SEO_TITLE", "MISSING_SEO_DESCRIPTION"]),
        missingAlt: has(codes, ["MISSING_IMAGE_ALT", "MISSING_IMAGES"]),
        missingCategory: has(codes, ["MISSING_CATEGORY"]),
        weakDescription: has(codes, [
          "DESCRIPTION_MISSING",
          "DESCRIPTION_TOO_SHORT",
          "DESCRIPTION_MISSING_DETAILS",
        ]),
        variantIssues: has(codes, [
          "VARIANT_DEFAULT_TITLE",
          "UNCLEAR_OPTION_NAMES",
          "MISSING_SKU",
          "MISSING_BARCODE",
        ]),
      },
    };
  });

  // Default sort: lowest score first (brief §12).
  rows.sort((a, b) => a.score - b.score);

  await saveScanSummary(shopDomain, {
    totalProductsScanned: scanned,
    averageScore: scan.averageScore,
    issueCounts: scan.issueCounts,
    lastScanAt: new Date(),
  });

  return { rows, scanned, averageScore: scan.averageScore, truncatedAtLimit };
}
