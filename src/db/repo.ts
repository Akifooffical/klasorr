import { env } from "../config/env.js";
import type { AiTrackResult, GaugeScore, RankResult } from "../types.js";

/**
 * İnce kalıcılık katmanı. Üretimde Prisma ile PostgreSQL/TimescaleDB'ye yazar.
 * DATABASE_URL tanımlı değilse (veya `prisma generate` çalışmadıysa) no-op'a
 * düşer ve konsola loglar — böylece worker, DB olmadan da çalışır.
 *
 * Prisma dinamik import edilir; bu sayede `prisma generate` yapılmamış bir
 * ortamda tip denetimi ve çalıştırma bozulmaz.
 */

let prisma: any | null = null;
let tried = false;

async function client(): Promise<any | null> {
  if (!env.databaseUrl) return null;
  if (tried) return prisma;
  tried = true;
  try {
    const mod: any = await import("@prisma/client");
    prisma = new mod.PrismaClient();
  } catch (err) {
    console.warn(`[repo] Prisma yüklenemedi, kalıcılık atlanıyor: ${(err as Error).message}`);
    prisma = null;
  }
  return prisma;
}

export async function saveScore(locationId: string, score: GaugeScore): Promise<void> {
  const db = await client();
  if (!db) {
    console.log(`[repo:mock] score_history <- ${locationId} gauge=${score.gauge}`);
    return;
  }
  await db.scoreHistory.create({
    data: {
      locationId,
      gauge: score.gauge,
      google: score.google,
      meta: score.meta,
      ai: score.ai,
    },
  });
}

export async function saveRanks(queryIdByText: Map<string, string>, ranks: RankResult[]): Promise<void> {
  const db = await client();
  if (!db) {
    console.log(`[repo:mock] rank_snapshot <- ${ranks.length} kayıt`);
    return;
  }
  for (const r of ranks) {
    const queryId = queryIdByText.get(r.query);
    if (!queryId) continue;
    await db.rankSnapshot.create({
      data: { queryId, channel: r.channel, position: r.position },
    });
  }
}

export async function saveMentions(queryIdByText: Map<string, string>, ai: AiTrackResult[]): Promise<void> {
  const db = await client();
  if (!db) {
    console.log(`[repo:mock] ai_mention <- ${ai.length} kayıt`);
    return;
  }
  for (const r of ai) {
    const queryId = queryIdByText.get(r.query);
    if (!queryId) continue;
    await db.aiMention.create({
      data: {
        queryId,
        engine: r.engine,
        mentioned: r.analysis.mentioned,
        rank: r.analysis.rank,
        sentiment: r.analysis.sentiment,
      },
    });
  }
}
