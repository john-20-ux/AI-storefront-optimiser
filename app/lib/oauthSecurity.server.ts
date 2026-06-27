import crypto from "node:crypto";

// Helpers for securing the OpenRouter OAuth handshake:
//  - a short-lived signed token that lets the top-level (first-party) start route
//    trust which shop initiated, without a Shopify session token
//  - cookie parsing + constant-time comparison for browser-binding the PKCE state

const TOKEN_TTL_MS = 10 * 60 * 1000;

function hmacKey(): string {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) throw new Error("SHOPIFY_API_SECRET is required to sign OAuth start tokens.");
  return secret;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Sign `{shop, exp}` so the start route can trust the shop without a session. */
export function signStartToken(shopDomain: string): string {
  const payload = b64url(JSON.stringify({ shop: shopDomain, exp: Date.now() + TOKEN_TTL_MS }));
  const sig = b64url(crypto.createHmac("sha256", hmacKey()).update(payload).digest());
  return `${payload}.${sig}`;
}

/** Verify a start token; returns the shop domain or null if invalid/expired. */
export function verifyStartToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = b64url(crypto.createHmac("sha256", hmacKey()).update(payload).digest());
  if (!safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (typeof data.shop !== "string" || typeof data.exp !== "number") return null;
    if (Date.now() > data.exp) return null;
    return data.shop;
  } catch {
    return null;
  }
}

/** Constant-time string comparison (length-safe). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export const OAUTH_STATE_COOKIE = "or_oauth_state";

export function stateCookie(state: string): string {
  return `${OAUTH_STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900`;
}

export function clearStateCookie(): string {
  return `${OAUTH_STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
