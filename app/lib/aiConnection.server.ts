import prisma from "../db.server";
import { encrypt, decrypt } from "./crypto.server";
import { AI_PROVIDERS, PROVIDER_LABELS, isAiProvider, type AiProvider } from "./aiProviders";

// Re-export client-safe provider constants for server-side callers.
export { AI_PROVIDERS, PROVIDER_LABELS, isAiProvider };
export type { AiProvider };

// Full credential including the decrypted key — server-only, never sent to the client.
export interface AiCredential {
  provider: AiProvider;
  apiKey: string;
  model: string | null;
}

// Safe metadata for the UI (no key material).
export interface AiConnectionPublic {
  provider: AiProvider;
  providerLabel: string;
  model: string | null;
  keyHint: string; // masked tail of the key
}

function maskKey(key: string): string {
  if (key.length <= 6) return "••••";
  return `••••${key.slice(-4)}`;
}

export async function getConnectionPublic(
  shopDomain: string,
): Promise<AiConnectionPublic | null> {
  const row = await prisma.aiConnection.findUnique({ where: { shopDomain } });
  if (!row || !isAiProvider(row.provider)) return null;
  let keyHint = "••••";
  try {
    keyHint = maskKey(decrypt(row.encryptedKey));
  } catch {
    keyHint = "•••• (key unreadable)";
  }
  return {
    provider: row.provider,
    providerLabel: PROVIDER_LABELS[row.provider],
    model: row.model,
    keyHint,
  };
}

export async function getCredential(shopDomain: string): Promise<AiCredential | null> {
  const row = await prisma.aiConnection.findUnique({ where: { shopDomain } });
  if (!row || !isAiProvider(row.provider)) return null;
  try {
    return { provider: row.provider, apiKey: decrypt(row.encryptedKey), model: row.model };
  } catch {
    return null;
  }
}

export async function hasConnection(shopDomain: string): Promise<boolean> {
  const row = await prisma.aiConnection.findUnique({
    where: { shopDomain },
    select: { shopDomain: true },
  });
  return Boolean(row);
}

export async function saveConnection(
  shopDomain: string,
  provider: AiProvider,
  apiKey: string,
  model: string | null,
) {
  const encryptedKey = encrypt(apiKey);
  const data = { provider, encryptedKey, model: model || null };
  return prisma.aiConnection.upsert({
    where: { shopDomain },
    update: data,
    create: { shopDomain, ...data },
  });
}

export async function deleteConnection(shopDomain: string) {
  await prisma.aiConnection.deleteMany({ where: { shopDomain } });
}
