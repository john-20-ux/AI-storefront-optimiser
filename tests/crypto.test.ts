import { describe, it, expect, beforeAll } from "vitest";

// 32-byte key (64 hex chars) for the test.
beforeAll(() => {
  process.env.ENCRYPTION_KEY = "a".repeat(64);
});

describe("crypto.server", () => {
  it("round-trips a secret through encrypt/decrypt", async () => {
    const { encrypt, decrypt } = await import("../app/lib/crypto.server");
    const secret = "sk-ant-api03-EXAMPLEsecretValue_1234567890";
    const enc = encrypt(secret);
    expect(enc).not.toContain(secret); // ciphertext, not plaintext
    expect(decrypt(enc)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", async () => {
    const { encrypt } = await import("../app/lib/crypto.server");
    expect(encrypt("same-value")).not.toBe(encrypt("same-value"));
  });

  it("fails to decrypt tampered ciphertext (GCM auth tag)", async () => {
    const { encrypt, decrypt } = await import("../app/lib/crypto.server");
    const enc = encrypt("secret");
    const buf = Buffer.from(enc, "base64");
    buf[buf.length - 1] ^= 0xff; // flip a ciphertext bit
    expect(() => decrypt(buf.toString("base64"))).toThrow();
  });

  it("rejects a missing/short ENCRYPTION_KEY", async () => {
    const { encrypt } = await import("../app/lib/crypto.server");
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "tooshort";
    expect(() => encrypt("x")).toThrow();
    process.env.ENCRYPTION_KEY = saved;
  });
});
