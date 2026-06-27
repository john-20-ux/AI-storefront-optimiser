import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShop, getScanSettings } from "../lib/shop.server";
import { getConnectionPublic } from "../lib/aiConnection.server";
import {
  AI_PROVIDERS,
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  CUSTOM_MODEL,
  isKnownModel,
  type AiProvider,
} from "../lib/aiProviders";
import { signStartToken } from "../lib/oauthSecurity.server";
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

  // Link to the first-party start route with a signed token (it creates the PKCE
  // state, sets the browser-binding cookie, and redirects to OpenRouter).
  let openRouterUrl: string | null = null;
  if (process.env.SHOPIFY_APP_URL && encryptionConfigured()) {
    openRouterUrl = `/openrouter/start?token=${encodeURIComponent(signStartToken(session.shop))}`;
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
  const testFetcher = useFetcher<{ ok: boolean; tested?: boolean; model?: string; error?: string }>();
  const busy = fetcher.state !== "idle";
  const aiBusy = aiFetcher.state !== "idle";
  const testBusy = testFetcher.state !== "idle";

  const [tone, setTone] = useState(data.tonePreference);
  const [audience, setAudience] = useState(data.targetAudience);
  const [aiRule, setAiRule] = useState(data.aiRule);
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const { key } of CHECKS) initial[key] = data.enabledChecks[key] !== false;
    return initial;
  });

  // AI connection form state
  const initialProvider: AiProvider = data.aiConnection?.provider ?? "anthropic";
  const initialModel = data.aiConnection?.model ?? "";
  const initialKnown = isKnownModel(initialProvider, initialModel);
  const [provider, setProvider] = useState<AiProvider>(initialProvider);
  const [apiKey, setApiKey] = useState("");
  const [modelSelect, setModelSelect] = useState(initialKnown ? initialModel : CUSTOM_MODEL);
  const [customModel, setCustomModel] = useState(initialKnown ? "" : initialModel);

  const effectiveModel = modelSelect === CUSTOM_MODEL ? customModel.trim() : modelSelect;

  const changeProvider = (value: AiProvider) => {
    setProvider(value);
    setModelSelect("");
    setCustomModel("");
  };

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
      { intent: "save", provider, apiKey, model: effectiveModel },
      { method: "POST", action: "/app/ai-connection" },
    );
    setApiKey("");
  };

  const testAi = () => {
    testFetcher.submit(
      { intent: "test", provider, apiKey, model: effectiveModel },
      { method: "POST", action: "/app/ai-connection" },
    );
  };

  const disconnectAi = () => {
    aiFetcher.submit({ intent: "disconnect" }, { method: "POST", action: "/app/ai-connection" });
  };

  const saved = fetcher.data && "ok" in fetcher.data && fetcher.data.ok;
  const aiError = aiFetcher.data && !aiFetcher.data.ok ? aiFetcher.data.error : null;
  const testData = testFetcher.data;
  const conn = data.aiConnection;

  return (
    <s-page heading="Settings">
      {saved ? (
        <s-section><s-banner tone="success"><s-paragraph>Settings saved.</s-paragraph></s-banner></s-section>
      ) : null}

      <s-section heading="AI connection">
        <s-paragraph>
          <s-text color="subdued">
            Connect your own AI provider. Your key is encrypted and used only to generate fixes for
            your store.
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
          <s-select
            label="Provider"
            value={provider}
            onChange={(e) => changeProvider(e.currentTarget.value as AiProvider)}
          >
            {AI_PROVIDERS.map((p) => (
              <s-option key={p} value={p}>{PROVIDER_LABELS[p]}</s-option>
            ))}
          </s-select>
          <s-password-field
            label="API key"
            placeholder={conn ? "Enter a new key to replace the saved one" : "sk-..."}
            value={apiKey}
            onInput={(e) => setApiKey(e.currentTarget.value)}
          />
          <s-select
            label="Model"
            value={modelSelect}
            onChange={(e) => setModelSelect(e.currentTarget.value)}
          >
            {PROVIDER_MODELS[provider].map((m) => (
              <s-option key={m.value || "default"} value={m.value}>{m.label}</s-option>
            ))}
          </s-select>
          {modelSelect === CUSTOM_MODEL ? (
            <s-text-field
              label="Custom model ID"
              placeholder="e.g. anthropic/claude-3.7-sonnet"
              value={customModel}
              onInput={(e) => setCustomModel(e.currentTarget.value)}
            />
          ) : null}

          {testData?.tested ? (
            testData.ok ? (
              <s-banner tone="success">
                <s-paragraph>Connection works{testData.model ? ` · model ${testData.model}` : ""}.</s-paragraph>
              </s-banner>
            ) : (
              <s-banner tone="critical">
                <s-paragraph>Connection failed: {testData.error}</s-paragraph>
              </s-banner>
            )
          ) : null}

          <s-stack direction="inline" gap="base">
            <s-button
              variant="primary"
              onClick={saveAi}
              {...(aiBusy ? { loading: true } : {})}
              {...(!data.encryptionReady ? { disabled: true } : {})}
            >
              Save AI connection
            </s-button>
            <s-button
              variant="secondary"
              onClick={testAi}
              {...(testBusy ? { loading: true } : {})}
            >
              Test connection
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
