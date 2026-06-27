import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchProductById } from "../shopify/fetchProducts";
import { scoreProduct, LEVEL_LABELS } from "../scoring";
import { stripHtml } from "../scoring/text";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const gid = `gid://shopify/Product/${params.id}`;
  const product = await fetchProductById(admin, gid);

  if (!product) {
    return { found: false as const, numericId: params.id ?? "" };
  }

  const result = scoreProduct(product);
  const firstImage = product.media.find((m) => m.mediaContentType === "IMAGE");

  return {
    found: true as const,
    numericId: params.id ?? "",
    gid,
    title: product.title,
    image: product.featuredImageUrl,
    status: product.status,
    score: result.score,
    level: result.level,
    levelLabel: LEVEL_LABELS[result.level],
    breakdown: result.breakdown,
    issues: result.issues,
    current: {
      title: product.title,
      description: stripHtml(product.descriptionHtml),
      seoTitle: product.seo.title ?? "",
      seoDescription: product.seo.description ?? "",
      tags: product.tags.join(", "),
      imageAlt: firstImage?.alt ?? "",
    },
  };
};

const levelTone: Record<string, "critical" | "warning" | "info" | "success"> = {
  critical: "critical",
  needs_work: "warning",
  good: "info",
  excellent: "success",
};

const severityTone: Record<string, "critical" | "warning" | "info"> = {
  high: "critical",
  medium: "warning",
  low: "info",
};

export default function ProductDetail() {
  const data = useLoaderData<typeof loader>();

  if (!data.found) {
    return (
      <s-page heading="Product not found">
        <s-link href="/app/products">Back to products</s-link>
        <s-section>
          <s-banner tone="critical">
            <s-paragraph>This product could not be loaded. It may have been deleted.</s-paragraph>
          </s-banner>
        </s-section>
      </s-page>
    );
  }

  const current = data.current;
  const beforeAfter: { label: string; value: string }[] = [
    { label: "Title", value: current.title },
    { label: "Description", value: current.description || "—" },
    { label: "SEO title", value: current.seoTitle || "—" },
    { label: "SEO meta description", value: current.seoDescription || "—" },
    { label: "Tags", value: current.tags || "—" },
    { label: "Image alt text", value: current.imageAlt || "—" },
  ];

  return (
    <s-page heading={data.title}>
      <s-link slot="breadcrumb" href="/app/products">
        Products
      </s-link>
      <s-button slot="primary-action" href={`/app/products/${data.numericId}/fixes`} variant="primary">
        Generate fixes
      </s-button>

      <s-section heading="Readiness">
        <s-stack direction="inline" gap="base" alignItems="center">
          {data.image ? <s-thumbnail src={data.image} alt={data.title} /> : null}
          <s-stack direction="block" gap="small-300">
            <s-heading>{data.score} / 100</s-heading>
            <s-badge tone={levelTone[data.level]}>{data.levelLabel}</s-badge>
            <s-text color="subdued">Status: {data.status}</s-text>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Score breakdown">
        <s-table>
          <s-table-header-row>
            <s-table-header>Category</s-table-header>
            <s-table-header format="numeric">Score</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {data.breakdown.map((b) => (
              <s-table-row key={b.key}>
                <s-table-cell>{b.label}</s-table-cell>
                <s-table-cell>
                  {b.score} / {b.max}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>

      <s-section heading={`Issues (${data.issues.length})`}>
        {data.issues.length === 0 ? (
          <s-paragraph>No issues found — this product is ready for AI discovery.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="small-300">
            {data.issues.map((issue) => (
              <s-box
                key={issue.code}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="small-400">
                  <s-stack direction="inline" gap="small-300" alignItems="center">
                    <s-badge tone={severityTone[issue.severity]}>{issue.severity}</s-badge>
                    <s-text type="strong">{issue.message}</s-text>
                  </s-stack>
                  <s-text color="subdued">{issue.suggestedAction}</s-text>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>

      <s-section heading="Before / after">
        <s-paragraph>
          <s-text color="subdued">
            Current Shopify data is shown on the left. Generate fixes to see suggested
            improvements on the right.
          </s-text>
        </s-paragraph>
        <s-table>
          <s-table-header-row>
            <s-table-header>Field</s-table-header>
            <s-table-header>Current</s-table-header>
            <s-table-header>Suggested</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {beforeAfter.map((field) => (
              <s-table-row key={field.label}>
                <s-table-cell>{field.label}</s-table-cell>
                <s-table-cell>{field.value}</s-table-cell>
                <s-table-cell>
                  <s-text color="subdued">—</s-text>
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
