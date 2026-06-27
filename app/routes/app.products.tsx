import { useMemo, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShop, getScanSettings } from "../lib/shop.server";
import { getPlan } from "../billing/plans";
import { runScan } from "../scoring/scan.server";
import { FILTERS, matchesFilter, type FilterKey } from "../lib/productFilters";
import prisma from "../db.server";

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
