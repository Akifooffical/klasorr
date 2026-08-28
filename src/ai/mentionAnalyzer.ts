import { env, hasAnthropic } from "../config/env.js";
import { structuredCall } from "./structured.js";
import type { EngineResponse, LocationInput, MentionAnalysis } from "../types.js";

/**
 * AI-izleme motorunun analiz katmanı (bkz. mimari doküman §4).
 * Bir motorun serbest-metin cevabını yapılandırılmış sinyale çevirir:
 * marka anıldı mı, kaçıncı sırada, hangi duyguyla, hangi rakiplerle.
 *
 * ANTHROPIC_API_KEY yoksa kural-tabanlı bir mock analiz kullanılır, böylece
 * demo anahtarsız da uçtan uca çalışır.
 */

const MENTION_SCHEMA = {
  type: "object",
  properties: {
    mentioned: { type: "boolean", description: "İşletme adı cevapta geçiyor mu" },
    rank: { type: ["integer", "null"], description: "Cevaptaki öneri sırası; anılmadıysa null" },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    competitorsNamed: { type: "array", items: { type: "string" }, description: "Cevapta anılan rakipler" },
    citedSource: { type: ["string", "null"], description: "Varsa alıntılanan kaynak/domain" },
    evidence: { type: "string", description: "İlgili kısa alıntı (kanıt)" },
  },
  required: ["mentioned", "rank", "sentiment", "competitorsNamed", "citedSource", "evidence"],
  additionalProperties: false,
} as const;

export async function analyzeMention(
  resp: EngineResponse,
  loc: LocationInput,
): Promise<MentionAnalysis> {
  if (!hasAnthropic()) return mockAnalyze(resp, loc);

  const prompt =
    `İşletme: "${loc.name}" (${loc.category}, ${loc.city}).\n` +
    `Bilinen rakipler: ${loc.competitors.join(", ") || "yok"}.\n` +
    `Aşağıdaki AI cevabını analiz et ve aracı çağırarak doldur. Sadece bu cevaba dayan.\n\n` +
    `--- AI CEVABI (${resp.engine}) ---\n${resp.text}`;

  try {
    const parsed = await structuredCall<MentionAnalysis>({
      model: env.mentionModel,
      prompt,
      toolName: "record_mention",
      description: "AI cevabındaki marka görünürlüğünü kaydet",
      schema: MENTION_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 1024,
    });
    if (parsed) return parsed;
  } catch (err) {
    console.warn(`[mentionAnalyzer] Claude analizi başarısız, mock: ${(err as Error).message}`);
  }
  return mockAnalyze(resp, loc);
}

/** Anahtar yokken kural-tabanlı yaklaşık analiz. */
function mockAnalyze(resp: EngineResponse, loc: LocationInput): MentionAnalysis {
  const text = resp.text.toLocaleLowerCase("tr");
  const name = loc.name.toLocaleLowerCase("tr");
  const mentioned = text.includes(name);
  const namedRivals = loc.competitors.filter((c) =>
    text.includes(c.toLocaleLowerCase("tr")),
  );
  let rank: number | null = null;
  if (mentioned) {
    // İşletmeden önce anılan rakip sayısı ~ sıra.
    const before = loc.competitors.filter((c) => {
      const ci = text.indexOf(c.toLocaleLowerCase("tr"));
      const ni = text.indexOf(name);
      return ci >= 0 && ci < ni;
    }).length;
    rank = before + 1;
  }
  const positive = /olumlu|iyi|öne çık|tercih|güvenilir|başarı/.test(text);
  return {
    mentioned,
    rank,
    sentiment: mentioned ? (positive ? "positive" : "neutral") : "neutral",
    competitorsNamed: namedRivals,
    citedSource: null,
    evidence: mentioned
      ? `"${loc.name}" cevapta anıldı.`
      : `"${loc.name}" bu cevapta anılmadı.`,
  };
}
