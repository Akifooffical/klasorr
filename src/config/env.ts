import "dotenv/config";

/**
 * Ortam değişkenleri tek yerden okunur. Anahtar yoksa ilgili entegrasyon
 * "mock" moduna düşer — böylece demo, anahtar/internet olmadan da çalışır.
 */
export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  mentionModel: process.env.GAUGE_MENTION_MODEL || "claude-haiku-4-5",
  insightModel: process.env.GAUGE_INSIGHT_MODEL || "claude-opus-5",

  serpApiKey: process.env.SERPAPI_KEY ?? "",
  dataForSeoLogin: process.env.DATAFORSEO_LOGIN ?? "",
  dataForSeoPassword: process.env.DATAFORSEO_PASSWORD ?? "",

  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  perplexityApiKey: process.env.PERPLEXITY_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",

  port: Number(process.env.PORT ?? 4000),
} as const;

export const hasAnthropic = () => env.anthropicApiKey.length > 0;
export const hasSerp = () =>
  env.serpApiKey.length > 0 || (env.dataForSeoLogin.length > 0 && env.dataForSeoPassword.length > 0);
