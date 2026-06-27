import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { createAuthorizeUrl } from "../lib/openrouter.server";
import { verifyStartToken, stateCookie } from "../lib/oauthSecurity.server";

// Top-level (first-party) start of the OpenRouter PKCE flow. Reached via a
// target="_top" link from the embedded Settings page, carrying a signed token
// that identifies the shop (no Shopify session token is present here). We create
// the PKCE state, set an HttpOnly cookie bound to it (browser-binding / CSRF
// defense), and redirect to OpenRouter.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const shopDomain = token ? verifyStartToken(token) : null;

  if (!shopDomain) {
    return new Response("Invalid or expired connect link. Reopen Settings and try again.", {
      status: 400,
      headers: { "content-type": "text/plain" },
    });
  }

  const { state, url: authorizeUrl } = await createAuthorizeUrl(shopDomain);
  return redirect(authorizeUrl, { headers: { "Set-Cookie": stateCookie(state) } });
};
