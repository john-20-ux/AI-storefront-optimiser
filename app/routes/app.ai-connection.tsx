import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  saveConnection,
  deleteConnection,
  isAiProvider,
} from "../lib/aiConnection.server";
import { encryptionConfigured } from "../lib/crypto.server";

// Save (paste) or disconnect a shop's AI credential. Posted to from Settings.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "disconnect") {
    await deleteConnection(session.shop);
    return { ok: true as const };
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
