import type { Candle, ChartPeriod } from "../market";
import type { Instrument, ProviderId } from "../instruments";
import type { Quote } from "../market-rules";

export interface MarketDataProvider {
  id: ProviderId | "demo";
  getQuotes(instruments: readonly Instrument[]): Promise<Quote[]>;
  getCandles(instrument: Instrument, period: ChartPeriod): Promise<Candle[]>;
}
export type ProviderStatus = { id: ProviderId | "demo"; label: string; status: "ok" | "partial" | "unavailable"; message: string | null };
export function numeric(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
export function unavailableQuote(instrument: Instrument, source: string): Quote {
  return { instrumentId: instrument.id, price: null, observedAt: null, status: "unavailable", latency: "unknown", marketOpen: null, changePercent: null, change7dPercent: null, high: null, low: null, volume: null, marketCap: null, sparkline: [], rank: null, image: null, source };
}
export async function fetchJson(url: string, init: RequestInit, provider: string): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
  // Do not log response URLs: one provider requires its token in the query string.
  if (!response.ok) throw new Error(`${provider} returned HTTP ${response.status}`);
  return response.json();
}
