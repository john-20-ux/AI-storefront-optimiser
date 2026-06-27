import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  saveConnection,
  getCredential,
  getConnectionPublic,
  deleteConnection,
  hasConnection,
} from "../../app/lib/aiConnection.server";
import { prisma, resetDb } from "../setup/db";

const SHOP = "demo.myshopify.com";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("aiConnection.server (DB)", () => {
  it("saves an encrypted key and decrypts it back", async () => {
    await saveConnection(SHOP, "anthropic", "sk-secret-123", "claude-haiku-4-5");

    const cred = await getCredential(SHOP);
    expect(cred).toMatchObject({ provider: "anthropic", apiKey: "sk-secret-123", model: "claude-haiku-4-5" });

    // Stored value must be ciphertext, not the plaintext key.
    const row = await prisma.aiConnection.findUnique({ where: { shopDomain: SHOP } });
    expect(row?.encryptedKey).toBeTruthy();
    expect(row?.encryptedKey).not.toContain("sk-secret-123");
  });

  it("public view masks the key and never leaks it", async () => {
    await saveConnection(SHOP, "openai", "sk-openai-abcd1234", null);
    const pub = await getConnectionPublic(SHOP);
    expect(pub?.provider).toBe("openai");
    expect(pub?.keyHint).not.toContain("sk-openai-abcd1234");
    expect(pub?.keyHint).toContain("1234"); // last 4 only
    expect(JSON.stringify(pub)).not.toContain("sk-openai-abcd1234");
  });

  it("upsert replaces the previous connection", async () => {
    await saveConnection(SHOP, "anthropic", "key-1", null);
    await saveConnection(SHOP, "openrouter", "key-2", "openai/gpt-4o");
    const cred = await getCredential(SHOP);
    expect(cred).toMatchObject({ provider: "openrouter", apiKey: "key-2", model: "openai/gpt-4o" });
    expect(await prisma.aiConnection.count()).toBe(1);
  });

  it("disconnect removes the credential", async () => {
    await saveConnection(SHOP, "anthropic", "key", null);
    expect(await hasConnection(SHOP)).toBe(true);
    await deleteConnection(SHOP);
    expect(await hasConnection(SHOP)).toBe(false);
    expect(await getCredential(SHOP)).toBeNull();
    expect(await getConnectionPublic(SHOP)).toBeNull();
  });
});
