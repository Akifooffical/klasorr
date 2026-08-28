import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";

/**
 * Yapılandırılmış çıktı yardımcı — zorunlu araç çağrısı (tool_choice) ile
 * modelden şemaya uygun JSON alır. SDK sürümünden bağımsız çalışır
 * (messages.parse / output_config gerektirmez).
 */

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

export async function structuredCall<T>(opts: {
  model: string;
  prompt: string;
  toolName: string;
  description: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T | null> {
  const { model, prompt, toolName, description, schema, maxTokens = 1024 } = opts;
  const tool = {
    name: toolName,
    description,
    input_schema: schema,
    strict: true,
  } as unknown as Anthropic.Tool;

  const res = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    tools: [tool],
    tool_choice: { type: "tool", name: toolName },
    messages: [{ role: "user", content: prompt }],
  });

  for (const block of res.content) {
    if (block.type === "tool_use") return block.input as T;
  }
  return null;
}
