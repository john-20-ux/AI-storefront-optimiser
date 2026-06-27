import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShop, getScanSettings } from "../lib/shop.server";
import { getConnectionPublic } from "../lib/aiConnection.server";
import { AI_PROVIDERS, PROVIDER_LABELS } from "../lib/aiProviders";
import { createAuthorizeUrl } from "../lib/openrouter.server";
import { encryptionConfigured } from "../lib/crypto.server";
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
  const aiConnection = await getConnectionPublic(session.shop);

  // Build a fresh OpenRouter authorize URL (PKCE) when the app URL is known.
  let openRouterUrl: string | null = null;
  if (process.env.SHOPIFY_APP_URL && encryptionConfigured()) {
    try {
      openRouterUrl = await createAuthorizeUrl(session.shop);
    } catch {
      openRouterUrl = null;
    }
  }

  return {
    tonePreference: settings.tonePreference,
    targetAudience: settings.targetAudience,
    aiRule: settings.aiRule,
    enabledChecks: (settings.enabledChecks as Record<string, boolean>) ?? {},
    aiConnection,
    openRouterUrl,
    encryptionReady: encryptionConfigured(),
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
  const aiFetcher = useFetcher<{ ok: boolean; error?: string }>();
  const busy = fetcher.state !== "idle";
  const aiBusy = aiFetcher.state !== "idle";

  const [tone, setTone] = useState(data.tonePreference);
  const [audience, setAudience] = useState(data.targetAudience);
  const [aiRule, setAiRule] = useState(data.aiRule);
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const { key } of CHECKS) initial[key] = data.enabledChecks[key] !== false;
    return initial;
  });

  // AI connection form state
  const [provider, setProvider] = useState(data.aiConnection?.provider ?? "anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(data.aiConnection?.model ?? "");

  const save = () => {
    const payload: Record<string, string> = {
      tonePreference: tone,
      targetAudience: audience,
      aiRule,
    };
    for (const { key } of CHECKS) payload[`check_${key}`] = checks[key] ? "true" : "false";
    fetcher.submit(payload, { method: "POST" });
  };

  const saveAi = () => {
    aiFetcher.submit(
      { intent: "save", provider, apiKey, model },
      { method: "POST", action: "/app/ai-connection" },
    );
    setApiKey("");
  };

  const disconnectAi = () => {
    aiFetcher.submit({ intent: "disconnect" }, { method: "POST", action: "/app/ai-connection" });
  };

  const saved = fetcher.data && "ok" in fetcher.data && fetcher.data.ok;
  const aiError = aiFetcher.data && !aiFetcher.data.ok ? aiFetcher.data.error : null;
  const conn = data.aiConnection;

  return (
    <s-page heading="Settings">
      {saved ? (
        <s-section><s-banner tone="success"><s-paragraph>Settings saved.</s-paragraph></s-banner></s-section>
      ) : null}

      <s-section heading="AI connection">
        <s-paragraph>
          <s-text color="subdued">
            Connect your own AI provider. Your key is encrypted and used only for your store's fix
            generation.
          </s-text>
        </s-paragraph>

        {!data.encryptionReady ? (
          <s-banner tone="critical">
            <s-paragraph>Server is missing ENCRYPTION_KEY — AI connections are disabled.</s-paragraph>
          </s-banner>
        ) : null}

        {conn ? (
          <s-banner tone="success">
            <s-paragraph>
              Connected to <s-text type="strong">{conn.providerLabel}</s-text>
              {conn.model ? ` · model ${conn.model}` : ""} · key {conn.keyHint}
            </s-paragraph>
          </s-banner>
        ) : (
          <s-paragraph><s-text color="subdued">No AI provider connected yet.</s-text></s-paragraph>
        )}

        {aiError ? (
          <s-banner tone="critical"><s-paragraph>{aiError}</s-paragraph></s-banner>
        ) : null}

        {data.openRouterUrl ? (
          <s-stack direction="block" gap="small-300">
            <s-text type="strong">Connect with OpenRouter (OAuth)</s-text>
            <s-paragraph>
              <s-text color="subdued">
                One click to authorize OpenRouter — access Claude, GPT, and many models with one key.
              </s-text>
            </s-paragraph>
            <s-button href={data.openRouterUrl} target="_top" variant="primary">
              Connect with OpenRouter
            </s-button>
          </s-stack>
        ) : null}

        <s-divider />

        <s-stack direction="block" gap="small-300">
          <s-text type="strong">Or paste an API key</s-text>
          <s-select label="Provider" value={provider} onChange={(e) => setProvider(e.currentTarget.value as typeof provider)}>
            {AI_PROVIDERS.map((p) => (
              <s-option key={p} value={p}>{PROVIDER_LABELS[p]}</s-option>
            ))}
          </s-select>
          <s-password-field
            label="API key"
            placeholder="sk-..."
            value={apiKey}
            onInput={(e) => setApiKey(e.currentTarget.value)}
          />
          <s-text-field
            label="Model (optional)"
            placeholder="Leave blank for a sensible default"
            value={model}
            onInput={(e) => setModel(e.currentTarget.value)}
          />
          <s-stack direction="inline" gap="base">
            <s-button
              variant="primary"
              onClick={saveAi}
              {...(aiBusy || !data.encryptionReady ? { loading: aiBusy } : {})}
              {...(!data.encryptionReady ? { disabled: true } : {})}
            >
              Save AI connection
            </s-button>
            {conn ? (
              <s-button variant="tertiary" tone="critical" onClick={disconnectAi}>
                Disconnect
              </s-button>
            ) : null}
          </s-stack>
        </s-stack>
      </s-section>

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
            Conservative and balanced use a faster, cheaper model; aggressive uses a higher-quality
            model (per provider).
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
