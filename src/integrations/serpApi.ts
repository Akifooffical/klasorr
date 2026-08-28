import { env, hasSerp } from "../config/env.js";
import type { LocationInput, RankChannelId, RankResult } from "../types.js";

/**
 * Yerel sıralama / harita verisi istemcisi.
 * Gerçekte SerpApi veya DataForSEO'nun "Google Maps" / "Local Pack" uç
 * noktalarına gider. SERPAPI_KEY yoksa deterministik mock döner, böylece
 * demo anahtar olmadan da çalışır.
 */

const CHANNELS: RankChannelId[] = ["local_pack", "maps", "organic"];

// Basit deterministik hash — mock'un istikrarlı olması için.
function seed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000;
}

async function fetchSerpApi(query: string, loc: LocationInput): Promise<RankResult[]> {
  // SerpApi Google Maps engine örnek çağrısı.
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", query);
  url.searchParams.set("ll", `@${loc.lat},${loc.lng},14z`);
  url.searchParams.set("api_key", env.serpApiKey);

  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`SerpApi ${res.status}`);
  const data: any = await res.json();
  const results: any[] = data.local_results ?? [];
  const idx = results.findIndex((r) =>
    String(r.title ?? "").toLowerCase().includes(loc.name.toLowerCase()),
  );
  const position = idx >= 0 ? idx + 1 : 0;
  // Tek çağrıdan yerel-paket sırasını türetiyoruz; diğer kanallar üretimde
  // ayrı uç noktalardan gelir. MVP'de aynı sırayı yaklaşık kullanıyoruz.
  return CHANNELS.map((channel) => ({
    channel,
    query,
    position: channel === "organic" ? (position ? position + 3 : 0) : position,
    live: true,
  }));
}

function mockRanks(query: string, loc: LocationInput): RankResult[] {
  const base = 1 + (seed(loc.name + query) % 8); // 1..8
  return CHANNELS.map((channel, i) => ({
    channel,
    query,
    position: Math.max(0, base + i - 1),
    live: false,
  }));
}

export async function getLocalRanks(query: string, loc: LocationInput): Promise<RankResult[]> {
  if (hasSerp()) {
    try {
      return await fetchSerpApi(query, loc);
    } catch (err) {
      console.warn(`[serpApi] canlı çağrı başarısız, mock'a düşülüyor: ${(err as Error).message}`);
    }
  }
  return mockRanks(query, loc);
}

/**
 * Geo-grid: konumun etrafında GxG ızgarada her hücre için sıralama.
 * Üretimde her hücre ayrı bir SerpApi çağrısıdır (maliyet: G×G sorgu).
 */
export async function getGeoGrid(
  query: string,
  loc: LocationInput,
  size = 6,
): Promise<number[]> {
  const cells: number[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (hasSerp()) {
        // Gerçek: merkezden kaydırılmış lat/lng ile ayrı çağrı.
        const dLat = (r - size / 2) * 0.01;
        const dLng = (c - size / 2) * 0.01;
        const ranks = await getLocalRanks(query, {
          ...loc,
          lat: loc.lat + dLat,
          lng: loc.lng + dLng,
        });
        cells.push(ranks[0]?.position ?? 0);
      } else {
        const dist = Math.hypot(r - size / 2, c - size / 2);
        cells.push(Math.round(1 + dist + (seed(`${query}${r}${c}`) % 4)));
      }
    }
  }
  return cells;
}
