import type { AiTrackResult, GaugeScore, MetaSignals, RankResult } from "../types.js";

/**
 * Gauge Score (bkz. mimari doküman §5).
 *   Gauge = 0.45·Google + 0.20·Meta + 0.35·AI
 * Her kanal 0–100'e normalize edilir.
 */

export const WEIGHTS = { google: 0.45, meta: 0.2, ai: 0.35 } as const;

/** Sıralama -> puan. 1. sıra = 100; her sıra k puan düşürür; 0 (yok) = 0. */
export function rankToScore(position: number, k = 9): number {
  if (!position || position <= 0) return 0;
  return Math.max(0, Math.round(100 - (position - 1) * k));
}

export function googleScore(ranks: RankResult[]): number {
  if (ranks.length === 0) return 0;
  // Kanal ağırlıkları: yerel paket ve harita organikten önemli.
  const w: Record<string, number> = { local_pack: 0.45, maps: 0.35, organic: 0.2 };
  let sum = 0;
  let wsum = 0;
  for (const r of ranks) {
    const weight = w[r.channel] ?? 0.2;
    sum += rankToScore(r.position) * weight;
    wsum += weight;
  }
  return Math.round(wsum ? sum / wsum : 0);
}

export function metaScore(m: MetaSignals): number {
  if (!m.active) return 0;
  // Erişim endeksi + CTR katkısı (CTR %5 ~ tam puan).
  const ctrScore = Math.min(100, (m.adCtr / 5) * 100);
  return Math.round(0.6 * m.reachIndex + 0.4 * ctrScore);
}

export function aiScore(results: AiTrackResult[]): number {
  if (results.length === 0) return 0;
  let sum = 0;
  for (const r of results) {
    const a = r.analysis;
    if (!a.mentioned) continue;
    const rankPart = rankToScore(a.rank ?? 5, 12); // AI cevabında sıra
    const sentimentBonus = a.sentiment === "positive" ? 10 : a.sentiment === "negative" ? -15 : 0;
    sum += Math.max(0, Math.min(100, rankPart + sentimentBonus));
  }
  // Motor kapsaması: kaç motorda görünüyorsun (anılmayan = 0).
  return Math.round(sum / results.length);
}

export function computeGauge(
  ranks: RankResult[],
  meta: MetaSignals,
  ai: AiTrackResult[],
): GaugeScore {
  const google = googleScore(ranks);
  const metaS = metaScore(meta);
  const aiS = aiScore(ai);
  const gauge = Math.round(WEIGHTS.google * google + WEIGHTS.meta * metaS + WEIGHTS.ai * aiS);
  return { gauge, google, meta: metaS, ai: aiS };
}
