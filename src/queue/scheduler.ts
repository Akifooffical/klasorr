import { jobsQueue } from "./queues.js";
import { CATALOG } from "../data/catalog.js";

/**
 * Zamanlayıcı: her konum için tekrarlayan yenileme işlerini kaydeder
 * (bkz. doküman §8). Plana göre frekans değişir; burada demo amaçlı günlük.
 *   npm run scheduler
 */
async function main() {
  for (const { location } of CATALOG) {
    await jobsQueue.add(
      "refresh:location",
      { locationId: location.id },
      {
        repeat: { pattern: "0 6 * * *" }, // her gün 06:00
        jobId: `refresh:${location.id}`, // idempotent tekrar anahtarı
      },
    );
    console.log(`Zamanlandı: refresh:location ${location.id} (${location.name})`);
  }
  console.log("Tekrarlayan işler kaydedildi. (İşlenmesi için worker gerekli.)");
  process.exit(0);
}

main().catch((err) => {
  console.error("Scheduler hatası:", err);
  process.exit(1);
});
