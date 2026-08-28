import { Worker } from "bullmq";
import { connection, QUEUE_NAME, type RefreshLocationData } from "./queues.js";
import { refreshLocation } from "../jobs/refreshLocation.js";

/**
 * İşçi süreç: kuyruktaki işleri işler. Redis gerektirir.
 *   npm run worker
 */
const worker = new Worker<RefreshLocationData>(
  QUEUE_NAME,
  async (job) => {
    if (job.name === "refresh:location") {
      return refreshLocation(job.data.locationId);
    }
    throw new Error(`Bilinmeyen iş: ${job.name}`);
  },
  {
    connection,
    // Oran limiti: dakikada en fazla 10 iş (dış API kotalarını korur).
    limiter: { max: 10, duration: 60_000 },
    concurrency: 3,
  },
);

worker.on("completed", (job) => console.log(`✓ iş tamam: ${job.id} (${job.name})`));
worker.on("failed", (job, err) => console.error(`✗ iş hata: ${job?.id} — ${err.message}`));

console.log("Gauge worker çalışıyor. İş bekleniyor…");
