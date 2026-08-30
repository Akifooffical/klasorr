# Handoff: Gauge — rota bazlı canlı 3D arka planlar

## Overview
Gauge'un tek shader'lı mevcut arka planı (aurora + kadran) yerine, **her sekmede farklı bir canlı WebGL sahnesi** çalıştıran bir arka plan sistemi. Sahneler ürünün konusunu anlatır: AI aramalarında lokasyon bazlı görünürlük ölçümü. Sekme değişince sahneler 0.85 s çapraz geçişle değişir, fare hareketine paralaks tepki verir.

## About the Design Files
Bu paketteki `prototypes/` klasöründeki HTML dosyaları **tasarım referansıdır** — hedeflenen görünüm ve davranışı gösteren prototipler, doğrudan kopyalanacak üretim kodu değil. Hedef, bu tasarımları projenin mevcut ortamında (Next.js 15 App Router + Tailwind v4 + TypeScript) o projenin yerleşik desenleriyle yeniden kurmaktır.

Bu handoff'ta ayrıca `src/` altında **hazır React/TypeScript uyarlaması** var: shader kaynakları ve prototipteki render döngüsü birebir aktarılmış durumda. Bunlar doğrudan repoya taşınabilir; yine de mevcut lint/tsconfig kurallarınıza uydurmak sizin tarafta bir gözden geçirme gerektirir.

## Fidelity
**High-fidelity.** Renkler, tipografi, hareket süreleri ve shader değerleri nihai. Arka plan sahneleri pikselden çok matematikle tanımlı; `gauge-scenes.ts` içindeki GLSL kaynakları birebir kullanılmalı — yeniden yazılırsa görünüm değişir.

## Kurulum (en kısa yol)
1. `src/components/gauge-scenes.ts` ve `src/components/GaugeSceneBackground.tsx` dosyalarını repoya kopyalayın.
2. Mevcut `src/components/SiteBackground.tsx` dosyasını bu paketteki sürümle değiştirin (veya `ROUTE_SCENE` haritasını mevcut dosyanıza taşıyın).
3. `ROUTE_SCENE` içindeki rotaları gerçek rotalarınızla eşleştirin (`/pricing`, `/docs` yer tutucudur; header'daki "Fiyatlar" ve "Dokümanlar" bağlantıları bugün `/#fiyat` ve GitHub'a gidiyor — hash bağlantıları kalacaksa sahne seçimini `useState` ile sekme tıklamasına bağlayın, `usePathname` hash'i görmez).
4. Ek bağımlılık yok. Sistem düz WebGL kullanır; `@react-three/fiber` / `three` bu arka plan için gerekmez (repoda başka yerde kullanılmıyorsa kaldırılabilir).

## Sahneler (6 adet)
| Anahtar | Ad | Ne anlatır | Öne çıkan hareket |
| --- | --- | --- | --- |
| `signalFlow` | Sinyal Akışı | 5 AI motorundan markaya akan sorgular | Işık paketleri merkeze akar, merkez düğüm fareyi takip eder |
| `geoGridRadar` | Geo-Grid Radar | Lokasyon ızgarası taranıyor, işletmeler ışık kolonu | Perspektif ızgara yaklaşır, 15 pin kolonu geçer, merkezden tarama dalgası |
| `prismaticDial` | Prizmatik Kadran | Görünürlük skoru enstrümanı | Eğik kadran, salınan iğne + pembe değer yayı |
| `layeredEngines` | Katmanlı Motorlar | ChatGPT / Gemini / Claude / Perplexity kıyası | Derinlikte yüzen 4 düzlem, canlı skor çubukları, tarama ışığı |
| `onboardingStair` | Kurulum Merdiveni | 3 adımda kurulum ilerleyişi | 6 basamak sırayla ışıklanır, tamamlanan basamakta halka darbesi |
| `competitorRadar` | Rakip Radarı | Bölgedeki rakipler | Polar tarama kolu döner, 9 blip tarandığında parlar |

### Sekme eşleşmesi (mevcut karar)
| Sekme (site-header.tsx) | Sahne |
| --- | --- |
| Ürün | `signalFlow` |
| Neden Gauge | `geoGridRadar` |
| Fiyatlar | `prismaticDial` |
| Dokümanlar | `layeredEngines` |

Uygulama rotaları için: `/dashboard` → `prismaticDial`, `/onboarding` → `onboardingStair`, `/competitors` → `competitorRadar`, `/actions` → `layeredEngines`.

## Interactions & Behavior
- **Sahne geçişi:** iki üst üste `<canvas>` katmanı. Yeni sahne arka katmanda derlenir, opaklığı 0 → 1'e `FADE_SECONDS = 0.85` içinde lineer taşınır; bitince eski katmanın bağlamı bırakılır. Geçiş sürerken yeni istek gelirse mevcut geçiş anında tamamlanır (snap) ve yeni geçiş başlar — aksi halde yanlış sahne kalıcı olur.
- **Fare paralaksı:** global `pointermove`, ekran koordinatı -0.5…0.5'e normalize edilip `uMouse` uniform'una geçer (her sahne farklı kullanır: ızgarada ufuk yüksekliği, kadranda eğim, akışta merkez düğüm konumu).
- **Zaman:** tek `requestAnimationFrame` döngüsü, `clock += dt` (başlangıç 6.0 — sahneler ilk karede "kurulmuş" görünür).
- **Performans:** `devicePixelRatio` 1.75'te sınırlı, `antialias: false`, katman başına tek üçgen. Sekme gizliyken (`visibilitychange`) çizim ve saat durur.
- **prefers-reduced-motion:** `reduce` ise saat ilerlemez — sahne donmuş tek kare olarak kalır (çapraz geçiş yine çalışır).
- **Açık/koyu zemin:** `uLight` uniform'u 1 olduğunda `toneMap()` sahneyi hue'yu koruyarak açık zemine çevirir (ink-on-white). Prototipte alt bardaki anahtar bunu test eder; üretimde `light` prop'u ile bağlanır.

## State Management
- `scene: SceneKey` — tek gerçek kaynak; `usePathname()` üzerinden `ROUTE_SCENE` ile türetilir.
- `light?: boolean` — opsiyonel; varsayılan `false`.
- Bileşen içi ref'ler (render dışı, re-render tetiklemez): `front` (öndeki katman indeksi), `fade` (0…1), `fading`, `clock`, `pointer`, `layers` (derlenmiş program + uniform konumları).
- Veri çekimi yok.

## Design Tokens
globals.css'teki mevcut tokenlar kullanılır — yeni renk eklenmedi:
- `--ink #07070c` · `--fg #edecf2` · `--muted #8e8ca3`
- `--signal #8b6cff` (shader: `vec3(.545,.424,1.)`)
- `--gold #33e0d6` (shader: `vec3(.2,.878,.839)`)
- `--accent-3 #ff5c8a` (shader: `vec3(1.,.361,.541)`)
- Açık zemin (yalnızca light modda): `#f3f2f2` zemin / `#201e1d` metin / `#0d7c74` kicker
- Vinyet: `radial-gradient(120% 90% at 50% 42%, rgba(7,7,12,.24) 0%, rgba(7,7,12,.52) 58%, rgba(7,7,12,.9) 100%)`
- Tipografi (prototipteki hero): Space Grotesk 700 `clamp(38px, min(6.4vw,9vh), 96px)` / `-0.035em`; gövde Inter 400 `clamp(15px,1.9vh,18px)`/1.5; kicker IBM Plex Mono 500 11px / `0.22em`
- Hareket: sahne geçişi 850 ms lineer; pill hover renk geçişi 200 ms

## Assets
Görsel asset yok — her sahne prosedürel GLSL. Font yükü mevcut `layout.tsx` (Space Grotesk / Inter / IBM Plex Mono) ile aynı.

## Files
- `src/components/gauge-scenes.ts` — 6 sahnenin fragment shader kaynağı + paylaşılan HEAD (hash/noise/fbm/toneMap) ve `SceneKey` tipi.
- `src/components/GaugeSceneBackground.tsx` — iki katmanlı çapraz geçişli WebGL arka plan bileşeni.
- `src/components/SiteBackground.tsx` — rota → sahne haritası, vinyet, scanline ve köşe etiketleri (mevcut dosyanın yerine geçer).
- `prototypes/Gauge Sekmeli Arka Planlar.dc.html` — 4 sekmeli canlı prototip (header sekmeleri sahneyi değiştirir).
- `prototypes/Gauge Backgrounds.dc.html` — 4 yönün yan yana karşılaştırma tahtası (kartlara tıklayınca tam ekran).
- `prototypes/support.js` — prototiplerin çalışma zamanı; HTML'leri tarayıcıda doğrudan açmak için gerekli.

## Bilinçli kararlar / dikkat
- Prototipteki "Fiyatlar" ve "Dokümanlar" içerikleri (başlık, plan sayısı, API metrikleri) **örnek metindir** — gerçek içerikle değiştirilmeli.
- Sahne sayısı 6, sekme sayısı 4: kalan iki sahne uygulama rotalarına atanmış durumda.
- Eski `GaugeBackground.tsx` ve `GaugeReelBackground.tsx` bu sistemle birlikte kullanılmıyor; kaldırma kararı sizde.
