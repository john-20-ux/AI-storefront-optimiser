import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { exchangeCode } from "../lib/openrouter.server";
import { saveConnection } from "../lib/aiConnection.server";

// Public top-level callback for the OpenRouter PKCE flow (not embedded, no Shopify
// session token). The shop is recovered from the PKCE state.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  if (!state || !code) {
    return new Response("Missing authorization parameters.", { status: 400 });
  }

  try {
    const { shopDomain, key } = await exchangeCode(state, code);
    await saveConnection(shopDomain, "openrouter", key, null);
    // Re-enter the embedded app; authenticate.admin handles the token bounce.
    return redirect(`/app/settings?shop=${encodeURIComponent(shopDomain)}&aiConnected=openrouter`);
  } catch (e) {
    return new Response(
      `AI connection failed: ${(e as Error).message}\n\nClose this window and try again from Settings.`,
      { status: 400, headers: { "content-type": "text/plain" } },
    );
  }
};
