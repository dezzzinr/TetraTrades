import type { Candle, ChartPeriod } from "../market";
import type { Instrument } from "../instruments";
import { numeric, unavailableQuote, type MarketDataProvider } from "./types";
import { coingeckoRequest } from "./coingecko-client";
import { mapMarketRow, quoteFromMarket, type RawCoinMarket } from "./coingecko-map";

const days: Record<ChartPeriod, number> = { "24H": 1, "7D": 7, "30D": 30, "1Y": 365 };
const cache: Record<ChartPeriod, number> = { "24H": 60, "7D": 300, "30D": 900, "1Y": 3600 };

export const coingeckoProvider: MarketDataProvider = {
  id: "coingecko",
  async getQuotes(items) {
    const quotes = [];
    for (let i = 0; i < items.length; i += 100) {
      const batch = items.slice(i, i + 100);
      const query = new URLSearchParams({ vs_currency: "usd", ids: batch.map(item => item.providerSymbol).join(","), per_page: String(batch.length), page: "1", sparkline: "true", price_change_percentage: "24h,7d" });
      const raw = await coingeckoRequest<unknown>(`/coins/markets?${query}`, 60);
      if (!Array.isArray(raw)) throw new Error("CoinGecko returned an invalid market response");
      for (const value of raw) {
        const market = mapMarketRow(value as RawCoinMarket);
        if (!market) continue;
        const instrument = batch.find(item => item.providerSymbol === market.id);
        if (!instrument) continue;
        quotes.push(quoteFromMarket(instrument, market));
      }
    }
    return quotes;
  },
  async getCandles(instrument: Instrument, period: ChartPeriod): Promise<Candle[]> {
    const query = new URLSearchParams({ vs_currency: "usd", days: String(days[period]) });
    const id = encodeURIComponent(instrument.providerSymbol);
    const [raw, volumeRaw] = await Promise.all([
      coingeckoRequest<unknown>(`/coins/${id}/ohlc?${query}`, cache[period]),
      coingeckoRequest<unknown>(`/coins/${id}/market_chart?${query}`, cache[period]).catch(() => null),
    ]);
    if (!Array.isArray(raw)) throw new Error("CoinGecko candle data is unavailable");
    const candles = raw.flatMap((row): Candle[] => {
      if (!Array.isArray(row) || row.length < 5) return [];
      const [timestamp, open, high, low, close] = row.map(numeric);
      if ([timestamp, open, high, low, close].some(value => value === null || value <= 0)) return [];
      return [{ timestamp: timestamp!, open: open!, high: high!, low: low!, close: close!, volume: 0 }];
    }).sort((a, b) => a.timestamp - b.timestamp);
    if (candles.length < 2) throw new Error("Not enough CoinGecko candles");
    const volumeRows = volumeRaw && typeof volumeRaw === "object" ? (volumeRaw as { total_volumes?: unknown }).total_volumes : null;
    const volumes = Array.isArray(volumeRows) ? volumeRows.flatMap(row => {
      if (!Array.isArray(row)) return [];
      const timestamp = numeric(row[0]), volume = numeric(row[1]);
      return timestamp !== null && volume !== null && volume >= 0 ? [{ timestamp, volume }] : [];
    }) : [];
    if (volumes.length > 1) {
      const nearest = (at: number) => volumes.reduce((best, point) => Math.abs(point.timestamp - at) < Math.abs(best.timestamp - at) ? point : best).volume;
      for (let i = 0; i < candles.length; i++) candles[i].volume = Math.max(0, nearest(candles[i + 1]?.timestamp ?? volumes.at(-1)!.timestamp) - nearest(candles[i].timestamp));
    }
    return candles;
  },
};
