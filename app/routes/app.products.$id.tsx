import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchProductById } from "../shopify/fetchProducts";
import { scoreProduct, LEVEL_LABELS } from "../scoring";
import { stripHtml } from "../scoring/text";
import { generateFixes } from "../ai/generate";
import { applySelectedFixes, type FieldSelection } from "../shopify/applyFixes.server";
import { getScanSettings } from "../lib/shop.server";
import { getPlan } from "../billing/plans";
import { hasConnection, getCredential } from "../lib/aiConnection.server";
import {
  FIELD_ROWS,
  displaySuggestion,
  applyValue,
  type FieldKey,
} from "../lib/suggestionFields";
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
    planAllowsGenerate: plan.canGenerateFixes,
    aiConnected: await hasConnection(session.shop),
    canGenerate: plan.canGenerateFixes && (await hasConnection(session.shop)),
    canApply: plan.canApplySingle,
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
  const gid = `gid://shopify/Product/${params.id}`;

  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  const plan = getPlan(shop?.planName);

  if (intent === "generate") {
    if (!plan.canGenerateFixes) {
      return { ok: false as const, kind: "generate" as const, error: "Upgrade your plan to generate AI fixes." };
    }
    const cred = await getCredential(session.shop);
    if (!cred) {
      return { ok: false as const, kind: "generate" as const, error: "Connect an AI provider in Settings first." };
    }
    const product = await fetchProductById(admin, gid);
    if (!product) return { ok: false as const, kind: "generate" as const, error: "Product not found." };
    const result = scoreProduct(product);
    const settings = await getScanSettings(session.shop);
    try {
      const suggestions = await generateFixes(product, result.issues, settings, cred);
      return { ok: true as const, kind: "generate" as const, suggestions };
    } catch (e) {
      return { ok: false as const, kind: "generate" as const, error: (e as Error).message };
    }
  }

  if (intent === "apply") {
    if (!plan.canApplySingle) {
      return { ok: false as const, kind: "apply" as const, error: "Upgrade your plan to apply fixes." };
    }
    const product = await fetchProductById(admin, gid);
    if (!product) return { ok: false as const, kind: "apply" as const, error: "Product not found." };

    const selection: FieldSelection = {};
    const get = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" ? v : undefined;
    };
    if (get("title") !== undefined) selection.title = get("title");
    if (get("descriptionHtml") !== undefined) selection.descriptionHtml = get("descriptionHtml");
    if (get("seoTitle") !== undefined) selection.seoTitle = get("seoTitle");
    if (get("seoDescription") !== undefined) selection.seoDescription = get("seoDescription");
    if (get("tags") !== undefined) selection.tags = get("tags");
    if (get("imageAlt") !== undefined) selection.imageAlt = get("imageAlt");

    const firstImageMediaId =
      product.media.find((m) => m.mediaContentType === "IMAGE")?.id ?? null;

    const { appliedFields, errors } = await applySelectedFixes(
      admin,
      gid,
      selection,
      firstImageMediaId,
    );

    if (errors.length) {
      return { ok: false as const, kind: "apply" as const, error: errors.join("; ") };
    }
    return { ok: true as const, kind: "apply" as const, appliedFields };
  }

  return { ok: false as const, kind: "generate" as const, error: "Unknown action." };
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
  const genFetcher = useFetcher<typeof action>();
  const applyFetcher = useFetcher<typeof action>();
  const allSelected = (): Record<FieldKey, boolean> => ({
    title: true,
    descriptionHtml: true,
    seoTitle: true,
    seoDescription: true,
    tags: true,
    imageAlt: true,
  });
  const [selected, setSelected] = useState<Record<FieldKey, boolean>>(allSelected);

  const suggestions =
    genFetcher.data && genFetcher.data.kind === "generate" && genFetcher.data.ok
      ? genFetcher.data.suggestions
      : undefined;

  // Reset selection when fresh suggestions arrive — render-time state adjustment
  // (React's recommended alternative to a setState-in-effect).
  const [prevSuggestions, setPrevSuggestions] = useState(suggestions);
  if (suggestions !== prevSuggestions) {
    setPrevSuggestions(suggestions);
    if (suggestions) setSelected(allSelected());
  }

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

  const genError =
    genFetcher.data && genFetcher.data.kind === "generate" && !genFetcher.data.ok
      ? genFetcher.data.error
      : null;
  const applyError =
    applyFetcher.data && applyFetcher.data.kind === "apply" && !applyFetcher.data.ok
      ? applyFetcher.data.error
      : null;
  const applySuccess =
    applyFetcher.data && applyFetcher.data.kind === "apply" && applyFetcher.data.ok
      ? applyFetcher.data.appliedFields
      : null;

  const isGenerating = genFetcher.state !== "idle";
  const isApplying = applyFetcher.state !== "idle";

  const current = data.current;
  const currentValue: Record<FieldKey, string> = {
    title: current.title,
    descriptionHtml: current.description,
    seoTitle: current.seoTitle,
    seoDescription: current.seoDescription,
    tags: current.tags,
    imageAlt: current.imageAlt,
  };

  const generate = () => genFetcher.submit({ intent: "generate" }, { method: "POST" });

  const applySelected = () => {
    if (!suggestions) return;
    const payload: Record<string, string> = { intent: "apply" };
    for (const { key } of FIELD_ROWS) {
      if (selected[key]) payload[key] = applyValue(key, suggestions);
    }
    applyFetcher.submit(payload, { method: "POST" });
  };

  const selectedCount = FIELD_ROWS.filter((f) => selected[f.key]).length;

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
      ) : data.planAllowsGenerate && !data.aiConnected ? (
        <s-button slot="primary-action" href="/app/settings" variant="primary">
          Connect AI in Settings
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

      {genError ? (
        <s-section>
          <s-banner tone="critical"><s-paragraph>{genError}</s-paragraph></s-banner>
        </s-section>
      ) : null}
      {applyError ? (
        <s-section>
          <s-banner tone="critical"><s-paragraph>{applyError}</s-paragraph></s-banner>
        </s-section>
      ) : null}
      {applySuccess ? (
        <s-section>
          <s-banner tone="success">
            <s-paragraph>
              Applied {applySuccess.length} change{applySuccess.length === 1 ? "" : "s"} to Shopify.
            </s-paragraph>
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
                <s-table-cell>{b.score} / {b.max}</s-table-cell>
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
            {suggestions
              ? "Review suggestions, untick any you don't want, then apply."
              : data.canGenerate
                ? "Generate fixes to see suggested improvements."
                : data.planAllowsGenerate && !data.aiConnected
                  ? "Connect an AI provider in Settings to generate suggestions."
                  : `Upgrade from the ${data.planLabel} plan to generate AI suggestions.`}
          </s-text>
        </s-paragraph>
        <s-table>
          <s-table-header-row>
            {suggestions ? <s-table-header>Apply</s-table-header> : null}
            <s-table-header>Field</s-table-header>
            <s-table-header>Current</s-table-header>
            <s-table-header>Suggested</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {FIELD_ROWS.map(({ key, label }) => (
              <s-table-row key={key}>
                {suggestions ? (
                  <s-table-cell>
                    <s-checkbox
                      label=""
                      accessibilityLabel={`Apply ${label}`}
                      checked={selected[key]}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [key]: e.currentTarget.checked }))
                      }
                    />
                  </s-table-cell>
                ) : null}
                <s-table-cell>{label}</s-table-cell>
                <s-table-cell>{currentValue[key] || "—"}</s-table-cell>
                <s-table-cell>
                  {suggestions ? (
                    <s-text>{displaySuggestion(key, suggestions)}</s-text>
                  ) : (
                    <s-text color="subdued">—</s-text>
                  )}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>

        {suggestions && data.canApply ? (
          <s-stack direction="block" gap="small-300">
            <s-banner tone="warning">
              <s-paragraph>
                Review all selected changes before applying. These updates are saved directly to your
                Shopify products.
              </s-paragraph>
            </s-banner>
            <s-button
              variant="primary"
              onClick={applySelected}
              {...(isApplying ? { loading: true } : {})}
              {...(selectedCount === 0 ? { disabled: true } : {})}
            >
              Apply {selectedCount} selected change{selectedCount === 1 ? "" : "s"}
            </s-button>
          </s-stack>
        ) : null}
        {suggestions && !data.canApply ? (
          <s-button href="/app/billing" variant="primary">
            Upgrade to apply changes
          </s-button>
        ) : null}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
