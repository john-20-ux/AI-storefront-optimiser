import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { exchangeCode } from "../lib/openrouter.server";
import { saveConnection } from "../lib/aiConnection.server";
import {
  parseCookie,
  safeEqual,
  clearStateCookie,
  OAUTH_STATE_COOKIE,
} from "../lib/oauthSecurity.server";

// Public top-level callback for the OpenRouter PKCE flow (not embedded, no Shopify
// session token). CSRF defense: the `state` query param must match the HttpOnly
// cookie set at /openrouter/start in this same browser. The shop is then recovered
// from the server-side PKCE state record.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  if (!state || !code) {
    return new Response("Missing authorization parameters.", { status: 400 });
  }

  // Browser-binding check before any token exchange.
  const cookieState = parseCookie(request.headers.get("cookie"), OAUTH_STATE_COOKIE);
  if (!cookieState || !safeEqual(cookieState, state)) {
    return new Response(
      "Authorization state mismatch. Close this window and reconnect from Settings.",
      { status: 400, headers: { "content-type": "text/plain", "Set-Cookie": clearStateCookie() } },
    );
  }

  try {
    const { shopDomain, key } = await exchangeCode(state, code);
    await saveConnection(shopDomain, "openrouter", key, null);
    // Re-enter the embedded app; authenticate.admin handles the token bounce.
    return redirect(`/app/settings?shop=${encodeURIComponent(shopDomain)}&aiConnected=openrouter`, {
      headers: { "Set-Cookie": clearStateCookie() },
    });
  } catch (e) {
    return new Response(
      `AI connection failed: ${(e as Error).message}\n\nClose this window and try again from Settings.`,
      { status: 400, headers: { "content-type": "text/plain", "Set-Cookie": clearStateCookie() } },
    );
  }
};
