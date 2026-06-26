import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShop, getScanSummary } from "../lib/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await ensureShop(session.shop);
  const summary = await getScanSummary(session.shop);

  const counts = (summary?.issueCounts as Record<string, number>) ?? {};
  return {
    hasScan: Boolean(summary?.lastScanAt),
    averageScore: summary?.averageScore ?? 0,
    totalProductsScanned: summary?.totalProductsScanned ?? 0,
    lastScanAt: summary?.lastScanAt ?? null,
    counts: {
      critical: counts.critical ?? 0,
      missingSeo: counts.missingSeo ?? 0,
      missingAlt: counts.missingAlt ?? 0,
      missingCategory: counts.missingCategory ?? 0,
      weakDescription: counts.weakDescription ?? 0,
    },
  };
};

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const scan = () => navigate("/app/products");

  if (!data.hasScan) {
    return (
      <s-page heading="AI Storefront Optimizer">
        <s-button slot="primary-action" variant="primary" onClick={scan}>
          Scan catalog
        </s-button>
        <s-section heading="Make your products ready for AI shopping, search, and better discovery">
          <s-paragraph>
            Your catalog has not been scanned yet. Scan your products to find
            missing SEO, weak descriptions, missing image alt text, and AI
            discovery issues.
          </s-paragraph>
          <s-button variant="primary" onClick={scan}>
            Scan catalog
          </s-button>
        </s-section>
      </s-page>
    );
  }

  const needsAttention =
    data.counts.critical +
    data.counts.missingSeo +
    data.counts.missingAlt +
    data.counts.missingCategory +
    data.counts.weakDescription;

  return (
    <s-page heading="AI Storefront Optimizer">
      <s-button slot="primary-action" variant="primary" onClick={scan}>
        Rescan catalog
      </s-button>

      <s-section heading="Catalog readiness">
        <s-stack direction="inline" gap="base">
          <SummaryCard label="Average readiness score" value={`${data.averageScore} / 100`} />
          <SummaryCard label="Products scanned" value={String(data.totalProductsScanned)} />
          <SummaryCard label="Critical products" value={String(data.counts.critical)} />
          <SummaryCard label="Missing SEO" value={String(data.counts.missingSeo)} />
          <SummaryCard label="Missing alt text" value={String(data.counts.missingAlt)} />
          <SummaryCard label="Missing category" value={String(data.counts.missingCategory)} />
        </s-stack>
      </s-section>

      <s-section heading="Main insight">
        <s-paragraph>
          {needsAttention > 0
            ? `${needsAttention} products need attention before they are ready for AI discovery.`
            : "Great work — your catalog is in good shape for AI discovery."}
        </s-paragraph>
        <s-button onClick={() => navigate("/app/products")}>View products</s-button>
      </s-section>
    </s-page>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="subdued"
      minInlineSize="160px"
    >
      <s-stack direction="block" gap="small-300">
        <s-text color="subdued">{label}</s-text>
        <s-heading>{value}</s-heading>
      </s-stack>
    </s-box>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
