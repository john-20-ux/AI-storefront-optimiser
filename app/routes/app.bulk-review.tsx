import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShop, getScanSettings } from "../lib/shop.server";
import { getPlan } from "../billing/plans";
import { runScan } from "../scoring/scan.server";
import { scoreProduct } from "../scoring";
import { stripHtml } from "../scoring/text";
import { fetchProductById } from "../shopify/fetchProducts";
import { generateFixes } from "../ai/generate";
import { applySelectedFixes, type FieldSelection } from "../shopify/applyFixes.server";
import { aiConfigured } from "../ai/client";
import prisma from "../db.server";

const MAX_BULK_GENERATE = 10;

const FIELDS = [
  { key: "title", label: "Title" },
  { key: "descriptionHtml", label: "Description" },
  { key: "seoTitle", label: "SEO title" },
  { key: "seoDescription", label: "SEO meta description" },
  { key: "tags", label: "Tags" },
  { key: "imageAlt", label: "Image alt text" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

interface ReviewField {
  key: FieldKey;
  label: string;
  current: string;
  suggested: string;
  value: string; // raw value to apply
}
interface ReviewProduct {
  numericId: string;
  title: string;
  fields: ReviewField[];
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  await ensureShop(session.shop);
  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  const plan = getPlan(shop?.planName);

  const { rows } = await runScan(admin, session.shop, plan.scanLimit);
  // Products that need work — lowest scores first (rows are already sorted).
  const candidates = rows.filter((r) => r.score < 75).slice(0, 50);

  return {
    candidates: candidates.map((r) => ({
      numericId: r.numericId,
      title: r.title,
      score: r.score,
      levelLabel: r.levelLabel,
      mainIssue: r.mainIssue ?? "—",
    })),
    canBulk: plan.canBulkApply && aiConfigured(),
    canBulkConfigured: plan.canBulkApply,
    planLabel: plan.label,
    maxGenerate: MAX_BULK_GENERATE,
  };
};

function displaySuggestion(key: FieldKey, s: { [k: string]: any }): string {
  if (key === "descriptionHtml") return stripHtml(s.descriptionHtml);
  if (key === "tags") return (s.tags as string[]).join(", ");
  return s[key] as string;
}
function rawValue(key: FieldKey, s: { [k: string]: any }): string {
  if (key === "tags") return (s.tags as string[]).join(", ");
  return s[key] as string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  const plan = getPlan(shop?.planName);
  if (!plan.canBulkApply) {
    return { ok: false as const, kind: "error" as const, error: "Upgrade to Growth or Pro for bulk review." };
  }

  if (intent === "generate-bulk") {
    if (!aiConfigured()) {
      return { ok: false as const, kind: "error" as const, error: "AI is not configured (missing ANTHROPIC_API_KEY)." };
    }
    const idsRaw = form.get("productIds");
    const ids: string[] = typeof idsRaw === "string" ? JSON.parse(idsRaw) : [];
    const settings = await getScanSettings(session.shop);
    const review: ReviewProduct[] = [];

    for (const numericId of ids.slice(0, MAX_BULK_GENERATE)) {
      const gid = `gid://shopify/Product/${numericId}`;
      const product = await fetchProductById(admin, gid);
      if (!product) continue;
      const result = scoreProduct(product);
      let suggestions;
      try {
        suggestions = await generateFixes(product, result.issues, settings);
      } catch {
        continue;
      }
      const firstImage = product.media.find((m) => m.mediaContentType === "IMAGE");
      const current: Record<FieldKey, string> = {
        title: product.title,
        descriptionHtml: stripHtml(product.descriptionHtml),
        seoTitle: product.seo.title ?? "",
        seoDescription: product.seo.description ?? "",
        tags: product.tags.join(", "),
        imageAlt: firstImage?.alt ?? "",
      };
      review.push({
        numericId,
        title: product.title,
        fields: FIELDS.map(({ key, label }) => ({
          key,
          label,
          current: current[key] || "—",
          suggested: displaySuggestion(key, suggestions),
          value: rawValue(key, suggestions),
        })),
      });
    }

    return { ok: true as const, kind: "review" as const, review };
  }

  if (intent === "apply-bulk") {
    const payloadRaw = form.get("payload");
    const payload: Array<{ numericId: string; fields: Record<string, string> }> =
      typeof payloadRaw === "string" ? JSON.parse(payloadRaw) : [];

    const results: Array<{ numericId: string; applied: number; error: string | null }> = [];
    for (const item of payload) {
      const gid = `gid://shopify/Product/${item.numericId}`;
      const product = await fetchProductById(admin, gid);
      if (!product) {
        results.push({ numericId: item.numericId, applied: 0, error: "Product not found." });
        continue;
      }
      const selection: FieldSelection = {};
      for (const [k, v] of Object.entries(item.fields)) {
        (selection as Record<string, string>)[k] = v;
      }
      const mediaId = product.media.find((m) => m.mediaContentType === "IMAGE")?.id ?? null;
      const { appliedFields, errors } = await applySelectedFixes(admin, gid, selection, mediaId);
      results.push({
        numericId: item.numericId,
        applied: appliedFields.length,
        error: errors.length ? errors.join("; ") : null,
      });
    }
    return { ok: true as const, kind: "applied" as const, results };
  }

  return { ok: false as const, kind: "error" as const, error: "Unknown action." };
};

export default function BulkReview() {
  const data = useLoaderData<typeof loader>();
  const genFetcher = useFetcher<typeof action>();
  const applyFetcher = useFetcher<typeof action>();

  const [selectedProducts, setSelectedProducts] = useState<Record<string, boolean>>({});
  const [fieldSel, setFieldSel] = useState<Record<string, boolean>>({});

  const review =
    genFetcher.data && genFetcher.data.kind === "review" ? genFetcher.data.review : null;
  const applied =
    applyFetcher.data && applyFetcher.data.kind === "applied" ? applyFetcher.data.results : null;
  const error =
    (genFetcher.data && genFetcher.data.kind === "error" && genFetcher.data.error) ||
    (applyFetcher.data && applyFetcher.data.kind === "error" && applyFetcher.data.error) ||
    null;

  const isGenerating = genFetcher.state !== "idle";
  const isApplying = applyFetcher.state !== "idle";

  const selectedIds = Object.keys(selectedProducts).filter((id) => selectedProducts[id]);

  const generate = () => {
    const ids = selectedIds.slice(0, data.maxGenerate);
    genFetcher.submit(
      { intent: "generate-bulk", productIds: JSON.stringify(ids) },
      { method: "POST" },
    );
  };

  const fieldKey = (numericId: string, key: string) => `${numericId}:${key}`;
  const isFieldOn = (numericId: string, key: string) => fieldSel[fieldKey(numericId, key)] !== false;

  const applyAll = () => {
    if (!review) return;
    const payload = review
      .map((p) => {
        const fields: Record<string, string> = {};
        for (const f of p.fields) {
          if (isFieldOn(p.numericId, f.key)) fields[f.key] = f.value;
        }
        return { numericId: p.numericId, fields };
      })
      .filter((p) => Object.keys(p.fields).length > 0);
    applyFetcher.submit(
      { intent: "apply-bulk", payload: JSON.stringify(payload) },
      { method: "POST" },
    );
  };

  if (!data.canBulkConfigured) {
    return (
      <s-page heading="Bulk Review">
        <s-section heading="Bulk review is a paid feature">
          <s-paragraph>
            Upgrade from the {data.planLabel} plan to Growth or Pro to generate and apply fixes
            across many products at once.
          </s-paragraph>
          <s-button href="/app/billing" variant="primary">View plans</s-button>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Bulk Review">
      {error ? (
        <s-section><s-banner tone="critical"><s-paragraph>{error}</s-paragraph></s-banner></s-section>
      ) : null}
      {applied ? (
        <s-section>
          <s-banner tone="success">
            <s-paragraph>
              Applied changes to {applied.filter((r) => !r.error).length} of {applied.length} products.
            </s-paragraph>
          </s-banner>
        </s-section>
      ) : null}

      {!review ? (
        <s-section heading={`Products needing work (${data.candidates.length})`}>
          <s-paragraph>
            <s-text color="subdued">
              Select up to {data.maxGenerate} products, then generate AI fixes to review before applying.
            </s-text>
          </s-paragraph>
          <s-table>
            <s-table-header-row>
              <s-table-header>Select</s-table-header>
              <s-table-header>Product</s-table-header>
              <s-table-header format="numeric">Score</s-table-header>
              <s-table-header>Main issue</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {data.candidates.map((c) => (
                <s-table-row key={c.numericId}>
                  <s-table-cell>
                    <s-checkbox
                      label=""
                      accessibilityLabel={`Select ${c.title}`}
                      checked={Boolean(selectedProducts[c.numericId])}
                      onChange={(e) =>
                        setSelectedProducts((p) => ({ ...p, [c.numericId]: e.currentTarget.checked }))
                      }
                    />
                  </s-table-cell>
                  <s-table-cell>{c.title}</s-table-cell>
                  <s-table-cell>{c.score}</s-table-cell>
                  <s-table-cell>{c.mainIssue}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
          <s-button
            variant="primary"
            onClick={generate}
            {...(isGenerating ? { loading: true } : {})}
            {...(selectedIds.length === 0 || !data.canBulk ? { disabled: true } : {})}
          >
            Generate fixes for {Math.min(selectedIds.length, data.maxGenerate)} selected
          </s-button>
          {!data.canBulk ? (
            <s-paragraph><s-text color="subdued">AI is not configured.</s-text></s-paragraph>
          ) : null}
        </s-section>
      ) : (
        <s-section heading="Review suggested changes">
          <s-banner tone="warning">
            <s-paragraph>
              Review all changes before applying. Product updates will be saved directly to Shopify.
            </s-paragraph>
          </s-banner>
          <s-table>
            <s-table-header-row>
              <s-table-header>Apply</s-table-header>
              <s-table-header>Product</s-table-header>
              <s-table-header>Field</s-table-header>
              <s-table-header>Current</s-table-header>
              <s-table-header>Suggested</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {review.flatMap((p) =>
                p.fields.map((f) => (
                  <s-table-row key={`${p.numericId}:${f.key}`}>
                    <s-table-cell>
                      <s-checkbox
                        label=""
                        accessibilityLabel={`Apply ${f.label} for ${p.title}`}
                        checked={isFieldOn(p.numericId, f.key)}
                        onChange={(e) =>
                          setFieldSel((prev) => ({
                            ...prev,
                            [fieldKey(p.numericId, f.key)]: e.currentTarget.checked,
                          }))
                        }
                      />
                    </s-table-cell>
                    <s-table-cell>{f.key === "title" ? p.title : ""}</s-table-cell>
                    <s-table-cell>{f.label}</s-table-cell>
                    <s-table-cell>{f.current}</s-table-cell>
                    <s-table-cell>{f.suggested}</s-table-cell>
                  </s-table-row>
                )),
              )}
            </s-table-body>
          </s-table>
          <s-stack direction="inline" gap="base">
            <s-button
              variant="primary"
              onClick={applyAll}
              {...(isApplying ? { loading: true } : {})}
            >
              Apply selected
            </s-button>
            <s-button href="/app/bulk-review">Cancel</s-button>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
