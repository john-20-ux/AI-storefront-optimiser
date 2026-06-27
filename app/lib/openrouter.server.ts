import crypto from "node:crypto";
import prisma from "../db.server";

// OpenRouter OAuth PKCE: https://openrouter.ai/docs/use-cases/oauth-pkce
// Flow: build authorize URL with a code_challenge (stored verifier keyed by state)
// → user authorizes → OpenRouter redirects to our callback with ?code=...
// → exchange code + verifier for a user-scoped API key.

const AUTHORIZE_URL = "https://openrouter.ai/auth";
const KEYS_URL = "https://openrouter.ai/api/v1/auth/keys";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function callbackUrl(state: string): string {
  const base = process.env.SHOPIFY_APP_URL ?? "";
  return `${base}/openrouter/callback?state=${encodeURIComponent(state)}`;
}

/**
 * Create a PKCE state for this shop and return the OpenRouter authorize URL.
 * The merchant's browser navigates to it (top-level).
 */
export async function createAuthorizeUrl(shopDomain: string): Promise<string> {
  const state = base64url(crypto.randomBytes(16));
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());

  // Prune stale states for this shop, then record the new one.
  await prisma.oAuthState.deleteMany({
    where: { shopDomain, createdAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } },
  });
  await prisma.oAuthState.create({ data: { state, shopDomain, codeVerifier } });

  const params = new URLSearchParams({
    callback_url: callbackUrl(state),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange the authorization code for an API key. Returns { shopDomain, key }.
 * Consumes (deletes) the state. Throws on invalid/expired state or exchange failure.
 */
export async function exchangeCode(
  state: string,
  code: string,
): Promise<{ shopDomain: string; key: string }> {
  const record = await prisma.oAuthState.findUnique({ where: { state } });
  if (!record) throw new Error("Invalid or expired authorization state.");

  // One-time use.
  await prisma.oAuthState.delete({ where: { state } }).catch(() => {});

  // Reject states older than 15 minutes.
  if (Date.now() - record.createdAt.getTime() > 15 * 60 * 1000) {
    throw new Error("Authorization state expired. Please try connecting again.");
  }

  const res = await fetch(KEYS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: record.codeVerifier,
      code_challenge_method: "S256",
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter token exchange failed (${res.status}).`);
  }
  const data = (await res.json()) as { key?: string };
  if (!data.key) throw new Error("OpenRouter did not return an API key.");

  return { shopDomain: record.shopDomain, key: data.key };
}
