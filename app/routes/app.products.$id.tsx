import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchProductById } from "../shopify/fetchProducts";
import { scoreProduct, LEVEL_LABELS } from "../scoring";
import { stripHtml } from "../scoring/text";
import { generateFixes, type Suggestions } from "../ai/generate";
import { getScanSettings } from "../lib/shop.server";
import { getPlan } from "../billing/plans";
import { aiConfigured } from "../ai/client";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const gid = `gid://shopify/Product/${params.id}`;
  const product = await fetchProductById(admin, gid);

  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  const plan = getPlan(shop?.planName);

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
    canGenerate: plan.canGenerateFixes && aiConfigured(),
    planLabel: plan.label,
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

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent !== "generate") {
    return { ok: false as const, error: "Unknown action." };
  }

  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  const plan = getPlan(shop?.planName);
  if (!plan.canGenerateFixes) {
    return { ok: false as const, error: "Upgrade your plan to generate AI fixes." };
  }
  if (!aiConfigured()) {
    return { ok: false as const, error: "AI is not configured (missing ANTHROPIC_API_KEY)." };
  }

  const gid = `gid://shopify/Product/${params.id}`;
  const product = await fetchProductById(admin, gid);
  if (!product) {
    return { ok: false as const, error: "Product not found." };
  }

  const result = scoreProduct(product);
  const settings = await getScanSettings(session.shop);

  try {
    const suggestions = await generateFixes(product, result.issues, settings);
    return { ok: true as const, suggestions };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
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

function suggestedValue(key: string, s: Suggestions | undefined): string | null {
  if (!s) return null;
  switch (key) {
    case "Title":
      return s.title;
    case "Description":
      return stripHtml(s.descriptionHtml);
    case "SEO title":
      return s.seoTitle;
    case "SEO meta description":
      return s.seoDescription;
    case "Tags":
      return s.tags.join(", ");
    case "Image alt text":
      return s.imageAlt;
    default:
      return null;
  }
}

export default function ProductDetail() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

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

  const suggestions =
    fetcher.data && "ok" in fetcher.data && fetcher.data.ok ? fetcher.data.suggestions : undefined;
  const error =
    fetcher.data && "ok" in fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const isGenerating = fetcher.state !== "idle";

  const current = data.current;
  const beforeAfter: { label: string; value: string }[] = [
    { label: "Title", value: current.title },
    { label: "Description", value: current.description || "—" },
    { label: "SEO title", value: current.seoTitle || "—" },
    { label: "SEO meta description", value: current.seoDescription || "—" },
    { label: "Tags", value: current.tags || "—" },
    { label: "Image alt text", value: current.imageAlt || "—" },
  ];

  const generate = () =>
    fetcher.submit({ intent: "generate" }, { method: "POST" });

  return (
    <s-page heading={data.title}>
      <s-link slot="breadcrumb" href="/app/products">
        Products
      </s-link>
      {data.canGenerate ? (
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={generate}
          {...(isGenerating ? { loading: true } : {})}
        >
          {suggestions ? "Regenerate fixes" : "Generate fixes"}
        </s-button>
      ) : (
        <s-button slot="primary-action" href="/app/billing" variant="primary">
          Upgrade to generate fixes
        </s-button>
      )}

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

      {error ? (
        <s-section>
          <s-banner tone="critical">
            <s-paragraph>{error}</s-paragraph>
          </s-banner>
        </s-section>
      ) : null}

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
              <s-box key={issue.code} padding="base" borderWidth="base" borderRadius="base">
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
            Current Shopify data is on the left. {data.canGenerate
              ? "Generate fixes to see suggested improvements on the right."
              : `Upgrade from the ${data.planLabel} plan to generate AI suggestions.`}
          </s-text>
        </s-paragraph>
        <s-table>
          <s-table-header-row>
            <s-table-header>Field</s-table-header>
            <s-table-header>Current</s-table-header>
            <s-table-header>Suggested</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {beforeAfter.map((field) => {
              const suggestion = suggestedValue(field.label, suggestions);
              return (
                <s-table-row key={field.label}>
                  <s-table-cell>{field.label}</s-table-cell>
                  <s-table-cell>{field.value}</s-table-cell>
                  <s-table-cell>
                    {suggestion ? (
                      <s-text>{suggestion}</s-text>
                    ) : (
                      <s-text color="subdued">—</s-text>
                    )}
                  </s-table-cell>
                </s-table-row>
              );
            })}
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
