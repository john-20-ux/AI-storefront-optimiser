// Plan definitions, scan limits, and feature entitlements (brief §23).
// Limits are enforced server-side in the scan loader and gated routes.

export type PlanName = "free" | "starter" | "growth" | "pro";

export interface Plan {
  name: PlanName;
  label: string;
  priceUsd: number;
  scanLimit: number;
  csvLimit: number;
  canGenerateFixes: boolean;
  canApplySingle: boolean;
  canBulkApply: boolean;
  features: string[];
}

export const PLANS: Record<PlanName, Plan> = {
  free: {
    name: "free",
    label: "Free",
    priceUsd: 0,
    scanLimit: 25,
    csvLimit: 25,
    canGenerateFixes: false,
    canApplySingle: false,
    canBulkApply: false,
    features: ["Scan up to 25 products", "Readiness score", "Product issues", "Limited CSV export"],
  },
  starter: {
    name: "starter",
    label: "Starter",
    priceUsd: 9,
    scanLimit: 250,
    csvLimit: 250,
    canGenerateFixes: true,
    canApplySingle: true,
    canBulkApply: false,
    features: ["Scan up to 250 products", "Generate fixes", "Apply individual fixes", "CSV export"],
  },
  growth: {
    name: "growth",
    label: "Growth",
    priceUsd: 29,
    scanLimit: 2000,
    csvLimit: 2000,
    canGenerateFixes: true,
    canApplySingle: true,
    canBulkApply: true,
    features: [
      "Scan up to 2,000 products",
      "Bulk fix review",
      "AI descriptions, alt text & SEO",
      "Priority issue list",
    ],
  },
  pro: {
    name: "pro",
    label: "Pro",
    priceUsd: 79,
    scanLimit: 100000,
    csvLimit: 100000,
    canGenerateFixes: true,
    canApplySingle: true,
    canBulkApply: true,
    features: [
      "Large catalog support",
      "Bulk apply",
      "Buyer question coverage",
      "Multi-language suggestions",
    ],
  },
};

export function getPlan(name: string | null | undefined): Plan {
  if (name && name in PLANS) return PLANS[name as PlanName];
  return PLANS.free;
}
