# Gauge — MVP iskeleti

Google, Meta ve AI aramalarındaki (ChatGPT · Perplexity · Gemini · AI Overview)
görünürlüğü **tek skorda** ölçen, sıralamayı gösteren ve üste taşıyan görünürlük
SaaS'ının çalışan Faz-1 iskeleti.

> Bu repo, mimari dokümandaki tasarımın (topla → puanla → aksiyona çevir)
> çalışır bir çekirdeğidir. Tüm dış entegrasyonlar **anahtar yoksa mock moduna**
> düşer, böylece proje internet/anahtar olmadan da uçtan uca çalışır.

## Hızlı başlangıç

```bash
npm install
cp .env.example .env      # (opsiyonel) anahtarları doldur
npm run demo              # uçtan uca boru hattını çalıştır
```

`npm run demo` çıktısı: yerel sıralama → AI-izleme motoru → **Gauge Skoru** →
aksiyon planı. Anahtar yoksa deterministik mock ile, `ANTHROPIC_API_KEY` (ve
istenirse `SERPAPI_KEY`, `OPENAI_API_KEY`…) ile gerçek verilerle çalışır.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run demo` | Uçtan uca boru hattı demosu (DB/Redis gerekmez). |
| `npm run api` | REST API (`http://localhost:4000`). |
| `npm run worker` | BullMQ işçisi (Redis gerekir). |
| `npm run scheduler` | Tekrarlayan yenileme işlerini kaydeder (Redis gerekir). |
| `npm run typecheck` | TypeScript tip denetimi. |
| `npm run prisma:generate` | Prisma istemcisini üretir (Postgres için). |

## Mimari eşlemesi

| Doküman bölümü | Kod |
|---|---|
| §4 AI-izleme motoru | `src/ai/trackPipeline.ts`, `src/ai/mentionAnalyzer.ts`, `src/integrations/aiEngines.ts` |
| §5 Gauge Score | `src/score/gaugeScore.ts` |
| §6 Veritabanı şeması | `prisma/schema.prisma`, `src/db/repo.ts` |
| §7 Backend & API | `src/api/server.ts` |
| §8 Kuyruk & zamanlama | `src/queue/*`, `src/jobs/refreshLocation.ts` |
| Yerel sıralama / geo-grid | `src/integrations/serpApi.ts` |
| Aksiyon planı | `src/ai/actionPlanner.ts` |

## Örnek API çağrıları

```bash
curl localhost:4000/locations
curl localhost:4000/locations/demo-1/score
curl localhost:4000/locations/demo-1/channels
curl localhost:4000/locations/demo-1/geo-grid
curl -X POST localhost:4000/locations/demo-1/actions/refresh
```

## AI-izleme motoru nasıl çalışır (§4)

1. **Şablon** — kategori + konumdan sorgu seti (`defaultTemplates`).
2. **Toplama** — her motorun **resmi API**'sine sor (`aiEngines.ts`). Web arayüzü
   scrape edilmez; AI Overview üretimde lisanslı SERP sağlayıcıdan gelir.
3. **Analiz** — her cevabı Claude ile yapılandırılmış sinyale çevir
   (`mentionAnalyzer.ts`, `messages.parse` + Zod): anıldı mı, sıra, duygu, rakipler.
4. **Puan** — sonuç Gauge Skoru'nun AI bileşenini besler (`gaugeScore.ts`).

Model varsayılanları: bahsedilme analizi `claude-haiku-4-5` (ucuz, yüksek hacim),
içgörü/aksiyon `claude-opus-5`. `.env` ile değiştirilebilir.

## Dağıtım

Mimariye uygun olarak (bkz. doküman §2) iki ayrı hedef:

**Web arayüzü → Vercel (statik).** `public/index.html` tamamen istemci-taraflı
çalışan Gauge arayüzüdür; ekstra kurulum/build gerekmez. Arka plan, sekmeye göre
değişen **çok-sahneli canlı WebGL sistemi**dir (6 prosedürel GLSL sahne, 0.85 s
çapraz geçiş, fare paralaksı, açık/koyu tonlama, `prefers-reduced-motion`; WebGL
yoksa yumuşak gradyana düşer). Tasarım spesifikasyonu: `design/BACKGROUND-HANDOFF.md`. Repo Vercel'e bağlanınca
`vercel.json` ile `public/` klasörü statik olarak yayınlanır. Her push otomatik
dağıtım tetikler. Yerelden: `npx vercel --prod`.

**API + worker → Fly.io / Render (Node servis).** `npm run api` ve `npm run worker`
kalıcı süreçlerdir; Vercel serverless yerine bir konteyner/servis platformunda
çalışır. Redis (kuyruk) ve PostgreSQL (Neon/Supabase) yönetilen servis olarak bağlanır.

## Notlar

- Kalıcılık (`src/db/repo.ts`) `DATABASE_URL` yoksa no-op'a düşer — worker DB'siz
  de çalışır.
- Üretimde API katmanı NestJS modüllerine, zaman serileri TimescaleDB
  hypertable'a karşılık gelir (bkz. mimari doküman).
- Bu bir kavram iskeletidir; örnek işletme verileri gerçek işletmeleri temsil etmez.
