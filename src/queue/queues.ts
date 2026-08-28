import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

/**
 * BullMQ kuyruk tanımları (bkz. doküman §8). Tüm dış veri toplama işleri
 * buradan zamanlanır; her iş oran-limitli ve idempotenttir.
 */
export const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });

export const QUEUE_NAME = "gauge-jobs";

export type JobName = "refresh:location";
export interface RefreshLocationData {
  locationId: string;
}

export const jobsQueue = new Queue<RefreshLocationData>(QUEUE_NAME, { connection });
