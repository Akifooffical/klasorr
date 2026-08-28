import express from "express";
import { env } from "../config/env.js";
import { CATALOG, getEntry } from "../data/catalog.js";
import { getLocalRanks, getGeoGrid } from "../integrations/serpApi.js";
import { trackQueries, defaultTemplates } from "../ai/trackPipeline.js";
import { computeGauge } from "../score/gaugeScore.js";
import { buildActionPlan } from "../ai/actionPlanner.js";
import type { AiTrackResult, GaugeScore, RankResult } from "../types.js";

/**
 * Gauge API (bkz. doküman §7). MVP'de boru hattından hesaplayıp servis eder;
 * üretimde önceden hesaplanmış veriyi PostgreSQL'den okur. DB/Redis olmadan
 * çalışır. Üretimde NestJS modüllerine karşılık gelir.
 *   npm run api
 */

interface Computed {
  at: number;
  ranks: RankResult[];
  ai: AiTrackResult[];
  score: GaugeScore;
  grid: number[];
}
const cache = new Map<string, Computed>();
const TTL = 5 * 60_000;

async function compute(id: string): Promise<Computed> {
  const cached = cache.get(id);
  if (cached && Date.now() - cached.at < TTL) return cached;
  const entry = getEntry(id);
  if (!entry) throw new Error("not_found");
  const { location, meta } = entry;
  const q = `${location.city}'da en iyi ${location.category.toLocaleLowerCase("tr")}`;
  const [ranks, ai, grid] = await Promise.all([
    getLocalRanks(q, location),
    trackQueries(location, defaultTemplates(location)),
    getGeoGrid(q, location, 6),
  ]);
  const score = computeGauge(ranks, meta, ai);
  const out: Computed = { at: Date.now(), ranks, ai, score, grid };
  cache.set(id, out);
  return out;
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, service: "gauge-api" }));

app.get("/locations", (_req, res) => {
  res.json(
    CATALOG.map((e) => ({
      id: e.location.id,
      name: e.location.name,
      category: e.location.category,
      city: e.location.city,
    })),
  );
});

app.get("/locations/:id/score", async (req, res) => {
  try {
    const { score } = await compute(req.params.id);
    res.json(score);
  } catch {
    res.status(404).json({ error: "Konum bulunamadı" });
  }
});

app.get("/locations/:id/channels", async (req, res) => {
  try {
    const { ranks, ai } = await compute(req.params.id);
    res.json({
      google: ranks.map((r) => ({ channel: r.channel, position: r.position })),
      ai: ai.map((r) => ({
        engine: r.engine,
        query: r.query,
        mentioned: r.analysis.mentioned,
        rank: r.analysis.rank,
        sentiment: r.analysis.sentiment,
      })),
    });
  } catch {
    res.status(404).json({ error: "Konum bulunamadı" });
  }
});

app.get("/locations/:id/geo-grid", async (req, res) => {
  try {
    const { grid } = await compute(req.params.id);
    res.json({ size: 6, cells: grid });
  } catch {
    res.status(404).json({ error: "Konum bulunamadı" });
  }
});

app.get("/locations/:id/ai-visibility", async (req, res) => {
  try {
    const { ai } = await compute(req.params.id);
    res.json(ai);
  } catch {
    res.status(404).json({ error: "Konum bulunamadı" });
  }
});

app.post("/locations/:id/actions/refresh", async (req, res) => {
  try {
    const entry = getEntry(req.params.id);
    if (!entry) throw new Error("not_found");
    const { ranks, ai, score } = await compute(req.params.id);
    const actions = await buildActionPlan(entry.location, score, ranks, ai);
    res.json({ actions });
  } catch {
    res.status(404).json({ error: "Konum bulunamadı" });
  }
});

app.listen(env.port, () => {
  console.log(`Gauge API → http://localhost:${env.port}`);
  console.log(`Dene: curl http://localhost:${env.port}/locations/demo-1/score`);
});
