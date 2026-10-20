import { assets as catalog, compactMoney, supportedCoins, type Candle, type ChartPeriod, type ChartPoint, type MarketSnapshot } from "@/lib/market";

const demoKey = process.env.COINGECKO_API_KEY || process.env.COINGECKO_DEMO_API_KEY;
const proKey = process.env.COINGECKO_PRO_API_KEY;
const apiBase = proKey ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3";
let lastGood: MarketSnapshot | null = null;

function headers(): HeadersInit {
  return {
    Accept: "application/json",
    ...(proKey ? { "x-cg-pro-api-key": proKey } : demoKey ? { "x-cg-demo-api-key": demoKey } : {}),
  };
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function coinGecko(path: string, revalidate: number): Promise<unknown> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: headers(),
    next: { revalidate },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);
  return response.json();
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  try {
    const query = new URLSearchParams({
      vs_currency: "usd",
      ids: supportedCoins.map((coin) => coin.id).join(","),
      order: "market_cap_desc",
      per_page: "20",
      page: "1",
      sparkline: "true",
      price_change_percentage: "24h,7d",
    });
    const raw = await coinGecko(`/coins/markets?${query}`, 60);
    if (!Array.isArray(raw)) throw new Error("Invalid market response");

    const mapped = raw.flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const value = item as Record<string, unknown>;
      const base = catalog.find((coin) => coin.id === value.id);
      const price = safeNumber(value.current_price);
      if (!base || price === null || price <= 0) return [];
      const sparkline = value.sparkline_in_7d as { price?: unknown } | null;
      const chart = Array.isArray(sparkline?.price)
        ? sparkline.price.filter((point): point is number => typeof point === "number" && Number.isFinite(point) && point > 0)
        : [];
      const image = typeof value.image === "string" && /^https:\/\/coin-images\.coingecko\.com\//.test(value.image)
        ? value.image
        : null;
      const updatedAt = typeof value.last_updated === "string" && Number.isFinite(Date.parse(value.last_updated))
        ? value.last_updated
        : null;
      return [{
        ...base,
        image,
        price,
        change: safeNumber(value.price_change_percentage_24h) ?? 0,
        change7d: safeNumber(value.price_change_percentage_7d_in_currency) ?? 0,
        volume: compactMoney(safeNumber(value.total_volume) ?? 0),
        cap: compactMoney(safeNumber(value.market_cap) ?? 0),
        volumeUsd: safeNumber(value.total_volume) ?? 0,
        capUsd: safeNumber(value.market_cap) ?? 0,
        chart,
        rank: safeNumber(value.market_cap_rank),
        high24h: safeNumber(value.high_24h),
        low24h: safeNumber(value.low_24h),
        updatedAt,
      }];
    });
    if (mapped.length !== supportedCoins.length || mapped.some((asset) => !asset.updatedAt)) {
      throw new Error("Market response is incomplete");
    }
    mapped.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    const oldestUpdate = Math.min(...mapped.map((asset) => Date.parse(asset.updatedAt!)));
    const updatedAt = new Date(oldestUpdate).toISOString();
    const snapshot: MarketSnapshot = {
      assets: mapped,
      status: Date.now() - oldestUpdate < 10 * 60 * 1000 ? "live" : "stale",
      updatedAt,
      source: "CoinGecko",
    };
    lastGood = snapshot;
    return snapshot;
  } catch (error) {
    console.error("Market data unavailable:", error);
    if (lastGood) return { ...lastGood, status: "stale" };
    return { assets: [], status: "unavailable", updatedAt: null, source: "CoinGecko" };
  }
}

const daysForPeriod: Record<ChartPeriod, number> = { "24H": 1, "7D": 7, "30D": 30, "1Y": 365 };
const cacheForPeriod: Record<ChartPeriod, number> = { "24H": 60, "7D": 300, "30D": 900, "1Y": 3600 };

export async function getCoinHistory(symbol: string, period: ChartPeriod): Promise<ChartPoint[]> {
  const coin = supportedCoins.find((item) => item.symbol === symbol);
  if (!coin || !daysForPeriod[period]) throw new Error("Unsupported coin or chart period");
  const query = new URLSearchParams({ vs_currency: "usd", days: String(daysForPeriod[period]) });
  const result = await coinGecko(`/coins/${coin.id}/market_chart?${query}`, cacheForPeriod[period]);
  if (!result || typeof result !== "object" || !Array.isArray((result as { prices?: unknown }).prices)) {
    throw new Error("Historical prices are unavailable");
  }
  const points = ((result as { prices: unknown[] }).prices).flatMap((entry): ChartPoint[] => {
    if (!Array.isArray(entry) || entry.length < 2) return [];
    const timestamp = safeNumber(entry[0]);
    const price = safeNumber(entry[1]);
    return timestamp !== null && price !== null && price > 0 ? [{ timestamp, price }] : [];
  });
  if (points.length < 2) throw new Error("Not enough historical prices");
  const step = Math.max(1, Math.ceil(points.length / 140));
  const sampled = points.filter((_, index) => index % step === 0);
  if (sampled.at(-1)?.timestamp !== points.at(-1)?.timestamp) sampled.push(points[points.length - 1]);
  return sampled;
}

// True OHLC candles for the candlestick chart, from CoinGecko's dedicated
// /ohlc endpoint (candle width is chosen automatically by CoinGecko based
// on the `days` window: ~30min candles for 1 day, ~4h for 7-30 days, ~4
// days for 1 year). That endpoint doesn't include volume, so it's paired
// with the /market_chart volume series and each volume point is bucketed
// into the candle interval it falls within.
export async function getCoinCandles(symbol: string, period: ChartPeriod): Promise<Candle[]> {
  const coin = supportedCoins.find((item) => item.symbol === symbol);
  if (!coin || !daysForPeriod[period]) throw new Error("Unsupported coin or chart period");
  const query = new URLSearchParams({ vs_currency: "usd", days: String(daysForPeriod[period]) });
  const [ohlcRaw, volumeRaw] = await Promise.all([
    coinGecko(`/coins/${coin.id}/ohlc?${query}`, cacheForPeriod[period]),
    coinGecko(`/coins/${coin.id}/market_chart?${query}`, cacheForPeriod[period]).catch(() => null),
  ]);
  if (!Array.isArray(ohlcRaw)) throw new Error("Candle data is unavailable");

  const candles: Candle[] = ohlcRaw.flatMap((entry: unknown): Candle[] => {
    if (!Array.isArray(entry) || entry.length < 5) return [];
    const timestamp = safeNumber(entry[0]);
    const open = safeNumber(entry[1]);
    const high = safeNumber(entry[2]);
    const low = safeNumber(entry[3]);
    const close = safeNumber(entry[4]);
    if (timestamp === null || open === null || high === null || low === null || close === null) return [];
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) return [];
    return [{ timestamp, open, high, low, close, volume: 0 }];
  });
  if (candles.length < 2) throw new Error("Not enough candle data");
  candles.sort((a, b) => a.timestamp - b.timestamp);

  // CoinGecko's free market_chart volume series is a *trailing 24h rolling*
  // total sampled at each point, not a per-interval traded amount - so a
  // candle's approximate traded volume is the increase in that rolling
  // total between the candle's start and end (floored at 0 to absorb
  // rolling-window/sampling noise). This is an approximation (the free
  // tier doesn't expose true per-candle volume), but it tracks relative
  // trading activity well enough for a volume strip under the chart.
  const volumePoints = (volumeRaw && typeof volumeRaw === "object" && Array.isArray((volumeRaw as { total_volumes?: unknown }).total_volumes))
    ? (volumeRaw as { total_volumes: unknown[] }).total_volumes.flatMap((entry): { timestamp: number; volume: number }[] => {
        if (!Array.isArray(entry) || entry.length < 2) return [];
        const timestamp = safeNumber(entry[0]);
        const volume = safeNumber(entry[1]);
        return timestamp !== null && volume !== null && volume >= 0 ? [{ timestamp, volume }] : [];
      })
    : [];
  if (volumePoints.length > 1) {
    const nearestVolumeAt = (at: number) => {
      let best = volumePoints[0];
      let bestDiff = Math.abs(best.timestamp - at);
      for (const point of volumePoints) {
        const diff = Math.abs(point.timestamp - at);
        if (diff < bestDiff) { best = point; bestDiff = diff; }
      }
      return best.volume;
    };
    const lastKnownTimestamp = volumePoints[volumePoints.length - 1].timestamp;
    for (let i = 0; i < candles.length; i++) {
      const start = candles[i].timestamp;
      const end = i + 1 < candles.length ? candles[i + 1].timestamp : lastKnownTimestamp;
      candles[i].volume = Math.max(0, nearestVolumeAt(end) - nearestVolumeAt(start));
    }
  }
  return candles;
}
