import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  signStartToken,
  verifyStartToken,
  safeEqual,
  parseCookie,
  stateCookie,
  clearStateCookie,
  OAUTH_STATE_COOKIE,
} from "../app/lib/oauthSecurity.server";

describe("start token", () => {
  it("round-trips a shop domain", () => {
    const token = signStartToken("demo.myshopify.com");
    expect(verifyStartToken(token)).toBe("demo.myshopify.com");
  });

  it("rejects a tampered payload", () => {
    const token = signStartToken("demo.myshopify.com");
    const [, sig] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ shop: "evil.myshopify.com", exp: Date.now() + 100000 })).toString("base64url")}.${sig}`;
    expect(verifyStartToken(forged)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifyStartToken("not-a-token")).toBeNull();
    expect(verifyStartToken("a.b.c")).toBeNull();
  });

  it("rejects an expired token", () => {
    // Hand-craft an expired but correctly-signed token using the same secret.
    const secret = process.env.SHOPIFY_API_SECRET!;
    const payload = Buffer.from(JSON.stringify({ shop: "demo.myshopify.com", exp: Date.now() - 1000 })).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    expect(verifyStartToken(`${payload}.${sig}`)).toBeNull();
  });
});

describe("safeEqual", () => {
  it("is true for equal strings and false otherwise", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false); // length-safe
  });
});

describe("parseCookie", () => {
  it("extracts a named cookie value", () => {
    expect(parseCookie("a=1; or_oauth_state=xyz; b=2", "or_oauth_state")).toBe("xyz");
  });
  it("returns null when absent or header missing", () => {
    expect(parseCookie("a=1; b=2", "or_oauth_state")).toBeNull();
    expect(parseCookie(null, "or_oauth_state")).toBeNull();
  });
});

describe("cookie builders", () => {
  it("sets HttpOnly/Secure/SameSite=Lax", () => {
    const c = stateCookie("xyz");
    expect(c).toContain(`${OAUTH_STATE_COOKIE}=xyz`);
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/Secure/);
    expect(c).toMatch(/SameSite=Lax/);
  });
  it("clear cookie sets Max-Age=0", () => {
    expect(clearStateCookie()).toMatch(/Max-Age=0/);
  });
});
