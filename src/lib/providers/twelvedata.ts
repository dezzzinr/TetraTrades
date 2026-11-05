import type { Candle, ChartPeriod } from "../market";
import type { Instrument } from "../instruments";
import type { FeedLatency, Quote } from "../market-rules";
import { fetchJson, numeric, unavailableQuote, type MarketDataProvider } from "./types";

const base = "https://api.twelvedata.com";
function request(path: string, params: Record<string, string>, revalidate: number) {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) throw new Error("TWELVEDATA_API_KEY is not configured");
  return fetchJson(`${base}${path}?${new URLSearchParams(params)}`, { headers: { Accept: "application/json", Authorization: `apikey ${key}` }, next: { revalidate } }, "Twelve Data");
}
function instrumentParams(instrument: Instrument): Record<string, string> {
  return { symbol: instrument.providerSymbol, ...(instrument.micCode ? { mic_code: instrument.micCode } : {}), ...(instrument.country ? { country: instrument.country } : {}), ...(instrument.providerType ? { type: instrument.providerType } : {}) };
}
function configuredLatency(): FeedLatency {
  const value = process.env.TWELVEDATA_FEED_LATENCY;
  return value === "real_time" || value === "delayed" ? value : "unknown";
}
/** Exported for contract tests. Batch responses are keyed by the requested symbol. */
export function mapQuote(raw: unknown, instrument: Instrument, now = Date.now()): Quote | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const price = numeric(row.close);
  if (row.status === "error" || price === null || price <= 0) return null;
  if (typeof row.currency === "string" && row.currency.toUpperCase() !== instrument.quoteCurrency) return null;
  // Requests are explicitly type=Index. Some quote payloads omit type; reject
  // an explicit conflicting type, and verify history meta strictly as well.
  const returnedType = row.type ?? row.instrument_type;
  if (instrument.providerType === "Index" && returnedType !== undefined && returnedType !== "Index") return null;
  const observed = numeric(row.last_quote_at) ?? numeric(row.timestamp);
  const observedAt = observed !== null && observed > 0 ? new Date(observed * 1000).toISOString() : typeof row.datetime === "string" && row.datetime.length === 10 ? `${row.datetime}T23:59:59Z` : null;
  const marketOpen = typeof row.is_market_open === "boolean" ? row.is_market_open : null;
  const fresh = observedAt !== null && now - Date.parse(observedAt) < 900_000 && Date.parse(observedAt) - now < 60_000;
  return { ...unavailableQuote(instrument, "Twelve Data"), price, observedAt, marketOpen,
    status: !fresh ? "stale" : marketOpen === false ? "closed" : "live", latency: configuredLatency(),
    changePercent: numeric(row.percent_change), change7dPercent: numeric(row.rolling_7d_change), high: numeric(row.high), low: numeric(row.low), volume: numeric(row.volume),
  };
}
const seriesConfig: Record<ChartPeriod, { interval: string; outputsize: string }> = {
  "24H": { interval: "5min", outputsize: "288" }, "7D": { interval: "1h", outputsize: "168" },
  "30D": { interval: "4h", outputsize: "180" }, "1Y": { interval: "1day", outputsize: "366" },
};
export function mapCandles(raw: unknown, instrument: Instrument): Candle[] {
  if (!raw || typeof raw !== "object") throw new Error("Invalid Twelve Data history response");
  const result = raw as { status?: string; meta?: Record<string, unknown>; values?: unknown };
  if (result.status === "error" || !Array.isArray(result.values)) throw new Error("Twelve Data history is unavailable for this subscription");
  if (result.meta?.currency && result.meta.currency !== instrument.quoteCurrency) throw new Error("Unexpected quote currency in historical data");
  if (instrument.providerType === "Index" && result.meta?.type !== "Index") throw new Error("Historical response did not match the requested index");
  const candles = result.values.flatMap((value): Candle[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    if (typeof row.datetime !== "string") return [];
    const timestamp = Date.parse(row.datetime.length === 10 ? `${row.datetime}T00:00:00Z` : `${row.datetime.replace(" ", "T")}Z`);
    const open = numeric(row.open), high = numeric(row.high), low = numeric(row.low), close = numeric(row.close);
    if (!Number.isFinite(timestamp) || [open, high, low, close].some(v => v === null || v <= 0)) return [];
    return [{ timestamp, open: open!, high: high!, low: low!, close: close!, volume: numeric(row.volume) ?? 0 }];
  }).sort((a, b) => a.timestamp - b.timestamp);
  if (candles.length < 2) throw new Error("Not enough historical observations");
  return candles;
}
export const twelvedataProvider: MarketDataProvider = {
  id: "twelvedata",
  async getQuotes(items) {
    const groups = new Map<string, Instrument[]>();
    for (const item of items) {
      // A bare ticker can identify different securities on different exchanges.
      // Indexes get individual, explicitly typed requests (e.g. SPX is ambiguous).
      const key = item.providerType === "Index" ? item.id : item.micCode ?? "reference";
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    const results = await Promise.allSettled([...groups.values()].map(async group => {
      const first = group[0];
      const params: Record<string, string> = { symbol: group.map(i => i.providerSymbol).join(","), timezone: "UTC", eod: "false" };
      if (first.providerType === "Index") Object.assign(params, instrumentParams(first));
      else if (first.micCode) params.mic_code = first.micCode;
      const raw = await request("/quote", params, 45);
      return group.flatMap(item => {
        const value = group.length === 1 ? raw : raw && typeof raw === "object" ? (raw as Record<string, unknown>)[item.providerSymbol] : null;
        const quote = mapQuote(value, item);
        return quote ? [quote] : [];
      });
    }));
    return results.flatMap(result => result.status === "fulfilled" ? result.value : []);
  },
  async getCandles(instrument, period) {
    const raw = await request("/time_series", { ...instrumentParams(instrument), ...seriesConfig[period], timezone: "UTC", adjust: "none", order: "asc" }, period === "24H" ? 60 : 300);
    return mapCandles(raw, instrument);
  },
};
