import { getEntry } from "../data/catalog.js";
import { getLocalRanks } from "../integrations/serpApi.js";
import { trackQueries, defaultTemplates } from "../ai/trackPipeline.js";
import { computeGauge } from "../score/gaugeScore.js";
import { saveScore, saveRanks, saveMentions } from "../db/repo.js";
import type { GaugeScore } from "../types.js";

/**
 * Bir konum için tam yenileme işi (bkz. doküman §8: rank:local + ai:track +
 * score:compute zincirinin bir konuma uygulanmış hâli).
 * Toplar -> puanlar -> kalıcılaştırır. Worker ve scheduler bunu çağırır.
 */
export async function refreshLocation(locationId: string): Promise<GaugeScore> {
  const entry = getEntry(locationId);
  if (!entry) throw new Error(`Konum bulunamadı: ${locationId}`);
  const { location, meta } = entry;

  const templates = defaultTemplates(location);
  const primaryQuery = `${location.city}'da en iyi ${location.category.toLocaleLowerCase("tr")}`;

  const ranks = await getLocalRanks(primaryQuery, location);
  const ai = await trackQueries(location, templates);
  const score = computeGauge(ranks, meta, ai);

  // queryText -> queryId eşlemesi üretimde TrackedQuery'den gelir; mock'ta boş.
  const queryIds = new Map<string, string>();
  await saveRanks(queryIds, ranks);
  await saveMentions(queryIds, ai);
  await saveScore(locationId, score);

  console.log(`[refreshLocation] ${location.name} → Gauge ${score.gauge}/100`);
  return score;
}
