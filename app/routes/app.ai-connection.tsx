import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  saveConnection,
  deleteConnection,
  getCredential,
  isAiProvider,
} from "../lib/aiConnection.server";
import { encryptionConfigured } from "../lib/crypto.server";
import { testConnection } from "../ai/test.server";

// Save (paste) or disconnect a shop's AI credential. Posted to from Settings.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "disconnect") {
    await deleteConnection(session.shop);
    return { ok: true as const };
  }

  if (intent === "test") {
    const provider = form.get("provider");
    const apiKey = String(form.get("apiKey") ?? "").trim();
    const model = String(form.get("model") ?? "").trim() || null;

    // Test the typed key, or fall back to the saved connection when blank.
    let cred;
    if (apiKey) {
      if (!isAiProvider(provider)) {
        return { ok: false as const, tested: true as const, error: "Invalid provider." };
      }
      cred = { provider, apiKey, model };
    } else {
      cred = await getCredential(session.shop);
      if (!cred) {
        return { ok: false as const, tested: true as const, error: "Enter an API key to test." };
      }
    }

    const result = await testConnection(cred);
    return result.ok
      ? { ok: true as const, tested: true as const, model: result.model }
      : { ok: false as const, tested: true as const, error: result.error ?? "Connection failed." };
  }

  if (intent === "save") {
    const provider = form.get("provider");
    const apiKey = String(form.get("apiKey") ?? "").trim();
    const model = String(form.get("model") ?? "").trim() || null;

    if (!isAiProvider(provider)) {
      return { ok: false as const, error: "Invalid provider." };
    }
    if (!apiKey) {
      return { ok: false as const, error: "API key is required." };
    }
    if (!encryptionConfigured()) {
      return { ok: false as const, error: "Server is missing ENCRYPTION_KEY; cannot store keys." };
    }

    await saveConnection(session.shop, provider, apiKey, model);
    return { ok: true as const };
  }

  return { ok: false as const, error: "Unknown action." };
};
