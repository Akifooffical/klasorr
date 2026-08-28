/**
 * Uçtan uca çalışan demo: Gauge boru hattını tek komutla koşturur.
 *   npm run demo
 *
 * Anahtar (ANTHROPIC_API_KEY, SERPAPI_KEY, OPENAI_API_KEY ...) varsa gerçek
 * API'leri kullanır; yoksa deterministik mock'a düşer — her hâlükârda çalışır.
 */
import { hasAnthropic, hasSerp } from "../config/env.js";
import type { LocationInput, MetaSignals } from "../types.js";
import { getLocalRanks, getGeoGrid } from "../integrations/serpApi.js";
import { trackQueries, defaultTemplates } from "../ai/trackPipeline.js";
import { computeGauge } from "../score/gaugeScore.js";
import { buildActionPlan } from "../ai/actionPlanner.js";

const loc: LocationInput = {
  id: "demo-1",
  name: "Boğaz Ağız & Diş Kliniği",
  category: "Diş Kliniği",
  city: "İstanbul",
  lat: 41.0403,
  lng: 28.9857,
  competitors: ["Nişantaşı Diş Estetik", "Levent İmplant Merkezi", "Kadıköy Gülüş Kliniği"],
};

const meta: MetaSignals = { reachIndex: 64, adCtr: 3.8, active: true };

function bar(v: number, width = 24): string {
  const n = Math.round((v / 100) * width);
  return "█".repeat(n) + "░".repeat(width - n);
}
function h(t: string) {
  console.log("\n" + t + "\n" + "─".repeat(t.length));
}

async function main() {
  console.log("═".repeat(56));
  console.log("  GAUGE — görünürlük boru hattı demosu");
  console.log("═".repeat(56));
  console.log(`İşletme : ${loc.name}`);
  console.log(`Kategori: ${loc.category} · ${loc.city}`);
  console.log(
    `Mod     : Claude ${hasAnthropic() ? "CANLI" : "mock"} · SERP ${hasSerp() ? "CANLI" : "mock"}`,
  );

  // 1) Yerel sıralama
  h("1 · Yerel sıralama (Google)");
  const templates = defaultTemplates(loc);
  const primaryQuery = `${loc.city}'da en iyi ${loc.category.toLocaleLowerCase("tr")}`;
  const ranks = await getLocalRanks(primaryQuery, loc);
  for (const r of ranks) {
    console.log(`  ${r.channel.padEnd(12)} → ${r.position ? "#" + r.position : "görünmüyor"}`);
  }

  // 2) Geo-grid özeti
  const grid = await getGeoGrid(primaryQuery, loc, 6);
  const top3 = grid.filter((c) => c > 0 && c <= 3).length;
  console.log(`  geo-grid     → 36 hücrenin ${top3}'ünde ilk 3`);

  // 3) AI-izleme motoru
  h("2 · AI-izleme motoru (ChatGPT · Perplexity · Gemini · AI Overview)");
  const ai = await trackQueries(loc, templates);
  for (const r of ai) {
    const a = r.analysis;
    const tag = a.mentioned ? `anıldı (sıra ${a.rank ?? "?"}, ${a.sentiment})` : "anılmadı";
    console.log(`  ${r.engine.padEnd(11)} "${r.query.slice(0, 30)}…" → ${tag}`);
  }

  // 4) Gauge Score
  h("3 · Gauge Skoru");
  const score = computeGauge(ranks, meta, ai);
  console.log(`  Google  ${bar(score.google)} ${score.google}`);
  console.log(`  Meta    ${bar(score.meta)} ${score.meta}`);
  console.log(`  AI      ${bar(score.ai)} ${score.ai}`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  GAUGE   ${bar(score.gauge)} ${score.gauge}/100`);

  // 5) Aksiyon planı
  h("4 · Üste çık & sat — aksiyon planı");
  const plan = await buildActionPlan(loc, score, ranks, ai);
  plan.forEach((a, i) => {
    console.log(`  ${i + 1}. [${a.impact.toUpperCase()}] ${a.title}  (${a.expectedLift})`);
    console.log(`     ${a.detail}`);
  });

  console.log("\n" + "═".repeat(56));
  if (!hasAnthropic()) {
    console.log("Not: ANTHROPIC_API_KEY tanımlı değil → analiz & plan mock üretildi.");
    console.log("Gerçek sonuç için .env'e anahtar ekleyip tekrar çalıştırın.");
  }
}

main().catch((err) => {
  console.error("Demo hatası:", err);
  process.exit(1);
});
