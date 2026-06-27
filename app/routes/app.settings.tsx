import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShop, getScanSettings } from "../lib/shop.server";
import prisma from "../db.server";

const TONES = ["simple", "premium", "friendly", "technical", "luxury", "playful"];
const AUDIENCES = ["general", "parents", "fitness", "fashion", "b2b", "beauty", "electronics"];
const AI_RULES = ["conservative", "balanced", "aggressive"];
const CHECKS = [
  { key: "seo", label: "SEO" },
  { key: "altText", label: "Alt text" },
  { key: "description", label: "Description" },
  { key: "category", label: "Product category" },
  { key: "tags", label: "Tags" },
  { key: "variants", label: "Variants" },
] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await ensureShop(session.shop);
  const settings = await getScanSettings(session.shop);
  return {
    tonePreference: settings.tonePreference,
    targetAudience: settings.targetAudience,
    aiRule: settings.aiRule,
    enabledChecks: (settings.enabledChecks as Record<string, boolean>) ?? {},
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();

  const enabledChecks: Record<string, boolean> = {};
  for (const { key } of CHECKS) {
    enabledChecks[key] = form.get(`check_${key}`) === "true";
  }

  await prisma.scanSettings.update({
    where: { shopDomain: session.shop },
    data: {
      tonePreference: String(form.get("tonePreference") ?? "simple"),
      targetAudience: String(form.get("targetAudience") ?? "general"),
      aiRule: String(form.get("aiRule") ?? "balanced"),
      enabledChecks,
    },
  });

  return { ok: true as const };
};

export default function Settings() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";

  const [tone, setTone] = useState(data.tonePreference);
  const [audience, setAudience] = useState(data.targetAudience);
  const [aiRule, setAiRule] = useState(data.aiRule);
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const { key } of CHECKS) initial[key] = data.enabledChecks[key] !== false;
    return initial;
  });

  const save = () => {
    const payload: Record<string, string> = {
      tonePreference: tone,
      targetAudience: audience,
      aiRule,
    };
    for (const { key } of CHECKS) payload[`check_${key}`] = checks[key] ? "true" : "false";
    fetcher.submit(payload, { method: "POST" });
  };

  const saved = fetcher.data && "ok" in fetcher.data && fetcher.data.ok;

  return (
    <s-page heading="Settings">
      {saved ? (
        <s-section><s-banner tone="success"><s-paragraph>Settings saved.</s-paragraph></s-banner></s-section>
      ) : null}

      <s-section heading="Brand tone">
        <s-select label="Tone" value={tone} onChange={(e) => setTone(e.currentTarget.value)}>
          {TONES.map((t) => (
            <s-option key={t} value={t}>{cap(t)}</s-option>
          ))}
        </s-select>
      </s-section>

      <s-section heading="Target audience">
        <s-select label="Audience" value={audience} onChange={(e) => setAudience(e.currentTarget.value)}>
          {AUDIENCES.map((a) => (
            <s-option key={a} value={a}>{cap(a)}</s-option>
          ))}
        </s-select>
      </s-section>

      <s-section heading="AI rewrite rule">
        <s-select label="AI rule" value={aiRule} onChange={(e) => setAiRule(e.currentTarget.value)}>
          {AI_RULES.map((r) => (
            <s-option key={r} value={r}>{cap(r)}</s-option>
          ))}
        </s-select>
        <s-paragraph>
          <s-text color="subdued">
            Conservative and balanced use a fast model; aggressive uses a higher-quality model.
          </s-text>
        </s-paragraph>
      </s-section>

      <s-section heading="Auto-check fields">
        <s-stack direction="block" gap="small-300">
          {CHECKS.map(({ key, label }) => (
            <s-checkbox
              key={key}
              label={label}
              checked={checks[key]}
              onChange={(e) => setChecks((p) => ({ ...p, [key]: e.currentTarget.checked }))}
            />
          ))}
        </s-stack>
      </s-section>

      <s-section>
        <s-button variant="primary" onClick={save} {...(busy ? { loading: true } : {})}>
          Save settings
        </s-button>
      </s-section>
    </s-page>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
