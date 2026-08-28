import type { AiEngineId, AiTrackResult, LocationInput } from "../types.js";
import { queryAllEngines } from "../integrations/aiEngines.js";
import { analyzeMention } from "./mentionAnalyzer.js";

/**
 * AI-izleme motoru boru hattı (bkz. doküman §4, Şekil 2):
 *   şablon -> her motora sor -> her cevabı LLM ile analiz et -> sonuç.
 */
export async function trackQueries(
  loc: LocationInput,
  queries: string[],
  engines?: AiEngineId[],
): Promise<AiTrackResult[]> {
  const out: AiTrackResult[] = [];
  for (const query of queries) {
    const responses = await queryAllEngines(query, loc, engines);
    const analyses = await Promise.all(
      responses.map(async (resp) => ({
        engine: resp.engine,
        query,
        analysis: await analyzeMention(resp, loc),
        live: resp.live,
      })),
    );
    out.push(...analyses);
  }
  return out;
}

/** Kategori + konumdan varsayılan sorgu şablonları üretir (üründeki "arama şablonları"). */
export function defaultTemplates(loc: LocationInput): string[] {
  const cat = loc.category.toLocaleLowerCase("tr");
  return [
    `${loc.city}'da en iyi ${cat}`,
    `${loc.city} ${cat} önerir misin`,
    `${loc.name} güvenilir mi`,
  ];
}
