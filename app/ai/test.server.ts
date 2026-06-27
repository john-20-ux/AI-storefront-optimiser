import type { AiCredential } from "../lib/aiConnection.server";
import { anthropicClient, openAiCompatibleClient, resolveModel } from "./client";

export interface TestResult {
  ok: boolean;
  model: string;
  error?: string;
}

/**
 * Cheap probe (1 output token) to validate a credential + model before saving.
 * Confirms the key authenticates and the chosen model is reachable.
 */
export async function testConnection(cred: AiCredential): Promise<TestResult> {
  const model = resolveModel(cred, "balanced");
  try {
    if (cred.provider === "anthropic") {
      const client = anthropicClient(cred.apiKey);
      await client.messages.create({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      });
    } else {
      const client = openAiCompatibleClient(cred);
      await client.chat.completions.create({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      });
    }
    return { ok: true, model };
  } catch (e) {
    return { ok: false, model, error: (e as Error).message };
  }
}
