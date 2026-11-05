import type { Candle, ChartPeriod } from "../market";
import type { Instrument } from "../instruments";
import { fetchJson, numeric, unavailableQuote, type MarketDataProvider } from "./types";

function request(symbol: string, from?: string) {
  const token = process.env.EODHD_API_TOKEN;
  if (!token) throw new Error("EODHD_API_TOKEN is not configured");
  // EODHD requires query-token authentication. Never expose this URL to the
  // browser or include it in errors/logs; the key has no NEXT_PUBLIC_ prefix.
  const params = new URLSearchParams({ api_token: token, fmt: "json", order: "a" });
  if (from) params.set("from", from);
  return fetchJson(`https://eodhd.com/api/eod/${encodeURIComponent(symbol)}?${params}`, { next: { revalidate: 3600 } }, "EODHD");
}
function rows(raw: unknown): Record<string, unknown>[] {
  return Array.isArray(raw) ? raw.filter((row): row is Record<string, unknown> => !!row && typeof row === "object") : [];
}
export function mapYieldHistory(raw: unknown, instrument: Instrument): Candle[] {
  const candles = rows(raw).flatMap((row): Candle[] => {
    const value = numeric(row.close);
    const timestamp = typeof row.date === "string" ? Date.parse(`${row.date}T00:00:00Z`) : NaN;
    // A yield is a percentage, not a USD price. Zero is a valid observation.
    if (value === null || value < -100 || value > 100 || !Number.isFinite(timestamp)) return [];
    return [{ timestamp, open: value, high: value, low: value, close: value, volume: 0 }];
  }).sort((a, b) => a.timestamp - b.timestamp);
  if (!candles.length) throw new Error(`No yield observations for ${instrument.symbol}`);
  return candles;
}
export const eodhdProvider: MarketDataProvider = {
  id: "eodhd",
  async getQuotes(items) {
    const results = await Promise.allSettled(items.map(async instrument => {
      const history = mapYieldHistory(await request(instrument.providerSymbol), instrument);
      const latest = history.at(-1)!, previous = history.at(-2);
      const age = Date.now() - latest.timestamp;
      return { ...unavailableQuote(instrument, "EODHD · daily yield"), price: latest.close, observedAt: new Date(latest.timestamp).toISOString(),
        status: age <= 8 * 86400000 && age >= -86400000 ? "closed" as const : "stale" as const,
        latency: "end_of_day" as const, marketOpen: false, changePercent: previous ? latest.close - previous.close : null,
        change7dPercent: history.length >= 6 ? latest.close - history.at(-6)!.close : null, sparkline: history.slice(-30).map(c => c.close),
      };
    }));
    return results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  },
  async getCandles(instrument, period) {
    const days = { "24H": 10, "7D": 14, "30D": 35, "1Y": 370 }[period];
    return mapYieldHistory(await request(instrument.providerSymbol, new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)), instrument);
  },
};
