import { useMemo, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShop, getScanSettings } from "../lib/shop.server";
import { getPlan } from "../billing/plans";
import { runScan, type ProductRow } from "../scoring/scan.server";
import prisma from "../db.server";

type FilterKey =
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

const FILTERS: { key: FilterKey; label: string }[] = [
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  await ensureShop(session.shop);
  await getScanSettings(session.shop);

  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  const plan = getPlan(shop?.planName);

  const { rows, scanned, averageScore, truncatedAtLimit } = await runScan(
    admin,
    session.shop,
    plan.scanLimit,
  );

  return {
    rows,
    scanned,
    averageScore,
    truncatedAtLimit,
    scanLimit: plan.scanLimit,
    planLabel: plan.label,
  };
};

function matchesFilter(row: ProductRow, filter: FilterKey): boolean {
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

const levelTone: Record<string, "critical" | "warning" | "info" | "success"> = {
  critical: "critical",
  needs_work: "warning",
  good: "info",
  excellent: "success",
};

export default function Products() {
  const data = useLoaderData<typeof loader>();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.rows.filter(
      (row) =>
        matchesFilter(row, filter) && (q === "" || row.title.toLowerCase().includes(q)),
    );
  }, [data.rows, filter, search]);

  return (
    <s-page heading="Products">
      <s-button slot="primary-action" href="/api/export" target="_blank">
        Export CSV
      </s-button>
      <s-section
        heading={`${data.scanned} products scanned · average readiness ${data.averageScore}/100`}
      >
        {data.truncatedAtLimit && (
          <s-banner tone="warning">
            <s-paragraph>
              Showing the first {data.scanLimit} products on the {data.planLabel} plan.
              Upgrade to scan your full catalog.
            </s-paragraph>
          </s-banner>
        )}

        <s-stack direction="inline" gap="base">
          <s-select
            label="Filter"
            labelAccessibilityVisibility="exclusive"
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value as FilterKey)}
          >
            {FILTERS.map((f) => (
              <s-option key={f.key} value={f.key}>
                {f.label}
              </s-option>
            ))}
          </s-select>
          <s-search-field
            label="Search products"
            labelAccessibilityVisibility="exclusive"
            placeholder="Search products"
            value={search}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
        </s-stack>

        {visible.length === 0 ? (
          <s-paragraph>No products match this filter.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Product</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header format="numeric">Score</s-table-header>
              <s-table-header>Readiness</s-table-header>
              <s-table-header>Main issue</s-table-header>
              <s-table-header format="numeric">Issues</s-table-header>
              <s-table-header>Action</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {visible.map((row) => (
                <s-table-row key={row.id}>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-300" alignItems="center">
                      {row.image ? (
                        <s-thumbnail src={row.image} alt={row.title} size="small" />
                      ) : null}
                      <s-text>{row.title}</s-text>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{row.status}</s-table-cell>
                  <s-table-cell>{row.score}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={levelTone[row.level]}>{row.levelLabel}</s-badge>
                  </s-table-cell>
                  <s-table-cell>{row.mainIssue ?? "—"}</s-table-cell>
                  <s-table-cell>{row.issueCount}</s-table-cell>
                  <s-table-cell>
                    <s-link href={`/app/products/${row.numericId}`}>View fixes</s-link>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
