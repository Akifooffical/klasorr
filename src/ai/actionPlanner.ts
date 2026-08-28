import { env, hasAnthropic } from "../config/env.js";
import { structuredCall } from "./structured.js";
import type { ActionItemOut, AiTrackResult, GaugeScore, LocationInput, RankResult } from "../types.js";

/**
 * Görünürlük boşluklarını okuyup önceliklendirilmiş "üste çık & sat" planı
 * üretir (bkz. doküman §4, aksiyon planı). Anahtar yoksa kural-tabanlı plan.
 */

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    actions: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          impact: { type: "string", enum: ["high", "medium", "low"] },
          expectedLift: { type: "string", description: "Beklenen etki, örn '+8 skor'" },
        },
        required: ["title", "detail", "impact", "expectedLift"],
        additionalProperties: false,
      },
    },
  },
  required: ["actions"],
  additionalProperties: false,
} as const;

export async function buildActionPlan(
  loc: LocationInput,
  score: GaugeScore,
  ranks: RankResult[],
  ai: AiTrackResult[],
): Promise<ActionItemOut[]> {
  if (!hasAnthropic()) return mockPlan(loc, score, ai);

  const aiSummary = ai
    .map((r) => `${r.engine}: ${r.analysis.mentioned ? `anıldı (sıra ${r.analysis.rank ?? "?"})` : "anılmadı"}`)
    .join("; ");
  const rankSummary = ranks.map((r) => `${r.channel}: ${r.position || "yok"}`).join("; ");
  const prompt =
    `İşletme "${loc.name}" (${loc.category}, ${loc.city}).\n` +
    `Gauge skoru ${score.gauge}/100 (Google ${score.google}, Meta ${score.meta}, AI ${score.ai}).\n` +
    `Yerel sıralama: ${rankSummary}.\n` +
    `AI görünürlük: ${aiSummary}.\n\n` +
    `En zayıf kanalları kapatıp müşteriye dönüşü artıracak, en fazla 6 somut ` +
    `aksiyon üret. Etkiye göre sırala; her biri uygulanabilir ve yerel işletmeye uygun olsun.`;

  try {
    const parsed = await structuredCall<{ actions: ActionItemOut[] }>({
      model: env.insightModel,
      prompt,
      toolName: "record_action_plan",
      description: "Önceliklendirilmiş aksiyon planını kaydet",
      schema: PLAN_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 1500,
    });
    if (parsed?.actions?.length) return parsed.actions;
  } catch (err) {
    console.warn(`[actionPlanner] Claude planı başarısız, mock: ${(err as Error).message}`);
  }
  return mockPlan(loc, score, ai);
}

function mockPlan(loc: LocationInput, score: GaugeScore, ai: AiTrackResult[]): ActionItemOut[] {
  const plan: ActionItemOut[] = [];
  const aiWeak = score.ai < 60;
  const notMentioned = ai.filter((r) => !r.analysis.mentioned).map((r) => r.engine);

  if (aiWeak) {
    plan.push({
      title: "AEO için sık sorulan soru sayfaları yayınla",
      detail: `AI motorlarının alıntıladığı Q&A formatında içerik: "${loc.category} fiyatı", "nasıl seçilir". ` +
        `Şu motorlarda henüz anılmıyorsun: ${notMentioned.join(", ") || "—"}.`,
      impact: "high",
      expectedLift: "+11 AI",
    });
  }
  if (score.google < 75) {
    plan.push({
      title: "Google Business profilini haftalık güncelle",
      detail: "Yorumları yanıtla, güncel foto ekle, kategori ve NAP tutarlılığını koru — yerel paket sinyali.",
      impact: "high",
      expectedLift: "+8 skor",
    });
  }
  plan.push({
    title: "Yorum toplama otomasyonu kur",
    detail: "Hizmet sonrası SMS/e-posta ile puan iste — hacim ve tazelik rakip farkını açar.",
    impact: "high",
    expectedLift: "+6 skor",
  });
  if (score.meta < 65) {
    plan.push({
      title: "Meta'da semt hedefli kampanya başlat",
      detail: `${loc.city} çevresinde 3 km yarıçap hedefleme + yeni görsel; düşen CTR'ı telafi et.`,
      impact: "medium",
      expectedLift: "+dönüşüm",
    });
  }
  plan.push({
    title: "40+ dizinde NAP tutarlılığını düzelt",
    detail: "İsim/adres/telefon uyumsuzlukları güveni ve harita sırasını düşürür.",
    impact: "medium",
    expectedLift: "+4 skor",
  });
  return plan.slice(0, 6);
}
