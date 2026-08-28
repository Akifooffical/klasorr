/** Gauge çekirdek domain tipleri (mimari doküman §5–6 ile hizalı). */

export type AiEngineId = "chatgpt" | "perplexity" | "gemini" | "ai_overview";
export type RankChannelId = "local_pack" | "maps" | "organic";
export type SentimentId = "positive" | "neutral" | "negative";

export interface LocationInput {
  id: string;
  name: string;
  category: string;
  city: string;
  lat: number;
  lng: number;
  /** Kıyaslanacak rakip işletme adları (lider tablosu). */
  competitors: string[];
}

/** Bir motora sorulan ham cevap (denetim izi için saklanır). */
export interface EngineResponse {
  engine: AiEngineId;
  query: string;
  /** Motorun ürettiği serbest metin cevap. */
  text: string;
  /** true ise cevap gerçek API'den, false ise mock. */
  live: boolean;
}

/** LLM analizinin yapılandırılmış çıktısı (bkz. §4). */
export interface MentionAnalysis {
  mentioned: boolean;
  rank: number | null;
  sentiment: SentimentId;
  competitorsNamed: string[];
  citedSource: string | null;
  evidence: string;
}

export interface AiTrackResult {
  engine: AiEngineId;
  query: string;
  analysis: MentionAnalysis;
  live: boolean;
}

/** Yerel sıralama ölçümü. */
export interface RankResult {
  channel: RankChannelId;
  query: string;
  /** 1 = en üst, 0 = görünmüyor. */
  position: number;
  live: boolean;
}

/** Meta kanalı özet sinyalleri. */
export interface MetaSignals {
  reachIndex: number; // 0-100
  adCtr: number; // %
  active: boolean;
}

export interface SubScores {
  google: number;
  meta: number;
  ai: number;
}

export interface GaugeScore extends SubScores {
  gauge: number;
}

export interface ActionItemOut {
  title: string;
  detail: string;
  impact: "high" | "medium" | "low";
  expectedLift: string;
}
