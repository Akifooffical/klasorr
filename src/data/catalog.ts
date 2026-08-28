import type { LocationInput, MetaSignals } from "../types.js";

/**
 * Demo kataloğu — API ve zamanlayıcının veritabanı olmadan çalışabilmesi için
 * küçük bir bellek içi işletme listesi. Üretimde bu veri `Location` tablosundan
 * gelir (bkz. şema §6).
 */
export interface CatalogEntry {
  location: LocationInput;
  meta: MetaSignals;
}

export const CATALOG: CatalogEntry[] = [
  {
    location: {
      id: "demo-1",
      name: "Boğaz Ağız & Diş Kliniği",
      category: "Diş Kliniği",
      city: "İstanbul",
      lat: 41.0403,
      lng: 28.9857,
      competitors: ["Nişantaşı Diş Estetik", "Levent İmplant Merkezi", "Kadıköy Gülüş Kliniği"],
    },
    meta: { reachIndex: 64, adCtr: 3.8, active: true },
  },
  {
    location: {
      id: "demo-2",
      name: "Haliç View Hotel",
      category: "Otel",
      city: "İstanbul",
      lat: 41.0256,
      lng: 28.974,
      competitors: ["Karaköy Loft Suites", "Pera Grand Hotel"],
    },
    meta: { reachIndex: 71, adCtr: 4.5, active: true },
  },
];

export function getEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((e) => e.location.id === id);
}
