import { env } from "../config/env.js";
import type { AiEngineId, EngineResponse, LocationInput } from "../types.js";

/**
 * AI motorlarını RESMİ API'leriyle sorgulayan istemciler.
 * - chatgpt   -> OpenAI Chat Completions
 * - perplexity-> Perplexity Chat Completions (OpenAI uyumlu)
 * - gemini    -> Google Generative Language API
 * - ai_overview-> gerçekte lisanslı SERP sağlayıcı (DataForSEO/SerpApi) üzerinden.
 *
 * İlgili anahtar yoksa deterministik mock cevap döner. ToS notu: motorların
 * web arayüzü scrape EDİLMEZ; yalnızca resmi API kullanılır (bkz. doküman §11).
 */

const ENGINES: AiEngineId[] = ["chatgpt", "perplexity", "gemini", "ai_overview"];

async function askOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`${baseUrl} ${res.status}`);
  const data: any = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function askGemini(apiKey: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data: any = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** Mock: gerçekçi bir "öneri listesi" cevabı üretir. */
function mockAnswer(engine: AiEngineId, query: string, loc: LocationInput): string {
  // Bazı motorlarda işletme anılır, bazılarında anılmaz — çeşitlilik için.
  const mentions = (loc.name.length + query.length + engine.length) % 3 !== 0;
  const rivals = loc.competitors.slice(0, 2);
  if (mentions) {
    return `"${query}" için öne çıkan seçenekler: ${rivals[0] ?? "yerel bir işletme"}, ` +
      `${loc.name} ve ${rivals[1] ?? "diğer sağlayıcılar"}. ${loc.name} olumlu yorumlarıyla ` +
      `${loc.city} bölgesinde iyi bir tercih olarak öne çıkıyor.`;
  }
  return `"${query}" için genellikle ${rivals[0] ?? "bilinen sağlayıcılar"} ve ` +
    `${rivals[1] ?? "büyük zincirler"} öneriliyor. Kesin bir liste için yerel yorumlara bakın.`;
}

async function askEngine(
  engine: AiEngineId,
  query: string,
  loc: LocationInput,
): Promise<EngineResponse> {
  const prompt =
    `${loc.city} bölgesinde "${query}" için en iyi işletmeleri, kısa gerekçelerle ` +
    `öneri sırasına göre listele.`;
  try {
    if (engine === "chatgpt" && env.openaiApiKey) {
      const text = await askOpenAiCompatible("https://api.openai.com/v1", env.openaiApiKey, "gpt-4o-mini", prompt);
      return { engine, query, text, live: true };
    }
    if (engine === "perplexity" && env.perplexityApiKey) {
      const text = await askOpenAiCompatible("https://api.perplexity.ai", env.perplexityApiKey, "sonar", prompt);
      return { engine, query, text, live: true };
    }
    if (engine === "gemini" && env.geminiApiKey) {
      const text = await askGemini(env.geminiApiKey, prompt);
      return { engine, query, text, live: true };
    }
    // ai_overview: üretimde SERP sağlayıcıdan gelir; burada her zaman mock.
  } catch (err) {
    console.warn(`[aiEngines:${engine}] canlı çağrı başarısız, mock: ${(err as Error).message}`);
  }
  return { engine, query, text: mockAnswer(engine, query, loc), live: false };
}

/** Tüm motorları (veya verilen alt kümeyi) bir sorgu için paralel sorgular. */
export async function queryAllEngines(
  query: string,
  loc: LocationInput,
  engines: AiEngineId[] = ENGINES,
): Promise<EngineResponse[]> {
  return Promise.all(engines.map((e) => askEngine(e, query, loc)));
}
