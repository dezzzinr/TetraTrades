import type { Candle, ChartPeriod } from "../market";
import type { Instrument } from "../instruments";
import type { Quote } from "../market-rules";
import type { MarketDataProvider } from "./types";

/** Explicit, synthetic fixtures. These are NOT historical or current market prices.
 * Nothing in provider mode falls back to this adapter. */
const fixtures: Record<string, number> = {
  BTC: 64000, ETH: 3200, SOL: 150, BNB: 580, AVAX: 35, LINK: 16, ADA: 0.45, DOGE: 0.12,
  AAPL: 220, MSFT: 420, NVDA: 125, AMZN: 190, GOOGL: 175, TSLA: 250,
  SPY: 550, QQQ: 480, TLT: 92, AGG: 99,
  EURUSD: 1.08, GBPUSD: 1.27, AUDUSD: 0.66, NZDUSD: 0.60,
  XAUUSD: 2350, XAGUSD: 29.5, WTIUSD: 78, XBRUSD: 82,
  SPX: 5500, IXIC: 17800, DJI: 40500, US2Y: 4.25, US10Y: 4.4, US20Y: 4.65, US30Y: 4.6,
};
export function demoPrice(instrument: Instrument, at: number): number {
  const base = fixtures[instrument.symbol] ?? 100;
  const seed = [...instrument.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const minute = Math.floor(at / 60_000);
  const wave = Math.sin(minute / 40 + seed) * 0.004;
  return Number((base * (1 + wave)).toFixed(instrument.priceDecimals));
}
function history(instrument: Instrument, period: ChartPeriod, now: number): Candle[] {
  const duration = { "24H": 86400000, "7D": 7 * 86400000, "30D": 30 * 86400000, "1Y": 365 * 86400000 }[period];
  const count = 100;
  const end = Math.floor(now / 60000) * 60000;
  const seed = instrument.id.length;
  return Array.from({ length: count }, (_, index) => {
    const timestamp = end - duration + Math.round(index * duration / (count - 1));
    const close = demoPrice(instrument, timestamp);
    const open = close * (1 + Math.sin(index * 1.7 + seed) * 0.002);
    const spread = Math.abs(close * 0.0025);
    return { timestamp, open, close, high: Math.max(open, close) + spread, low: Math.min(open, close) - spread, volume: instrument.valueKind === "yield" || instrument.assetClass === "forex" ? 0 : 1000 + (index * 137 + seed * 53) % 9000 };
  });
}
export const demoProvider: MarketDataProvider = {
  id: "demo",
  async getQuotes(items) {
    const now = Date.now();
    return items.map((instrument): Quote => {
      const candles = history(instrument, "7D", now);
      const price = demoPrice(instrument, now);
      return { instrumentId: instrument.id, price, observedAt: new Date(now).toISOString(), status: "demo", latency: "demo", marketOpen: true,
        changePercent: instrument.valueKind === "yield" ? price - candles.at(-2)!.close : (price / candles.at(-2)!.close - 1) * 100,
        change7dPercent: (price / candles[0].close - 1) * 100, high: Math.max(...candles.slice(-5).map(c => c.high)), low: Math.min(...candles.slice(-5).map(c => c.low)),
        volume: null, marketCap: null, sparkline: candles.map(c => c.close), rank: null, image: null, source: "Synthetic demo fixtures" };
    });
  },
  async getCandles(instrument, period) { return history(instrument, period, Date.now()); },
};
