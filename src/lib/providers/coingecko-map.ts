import type { Instrument } from "../instruments";
import type { Quote } from "../market-rules";
import { numeric, unavailableQuote } from "./types";

export type RawCoinMarket = Record<string, unknown> & { id?: unknown; symbol?: unknown; name?: unknown; image?: unknown };
export type CryptoMarketData = {
  id: string; symbol: string; name: string; image: string | null; price: number | null;
  change24h: number | null; change7d: number | null; marketCap: number | null; volume: number | null;
  high24h: number | null; low24h: number | null; rank: number | null; circulatingSupply: number | null;
  totalSupply: number | null; maxSupply: number | null; ath: number | null; athDate: string | null;
  atl: number | null; atlDate: string | null; lastUpdated: string | null; sparkline: number[];
};

export function safeImage(value: unknown): string | null {
  return typeof value === "string" && /^https:\/\/(coin-images\.coingecko\.com|assets\.coingecko\.com|static\.coingecko\.com)\//.test(value) ? value : null;
}
export function mapMarketRow(row: RawCoinMarket): CryptoMarketData | null {
  if (typeof row.id !== "string" || !row.id) return null;
  const sparkline = row.sparkline_in_7d as { price?: unknown } | undefined;
  const updated = typeof row.last_updated === "string" && Number.isFinite(Date.parse(row.last_updated)) ? row.last_updated : null;
  return {
    id: row.id,
    symbol: typeof row.symbol === "string" ? row.symbol : "",
    name: typeof row.name === "string" ? row.name : row.id,
    image: safeImage(row.image),
    price: numeric(row.current_price),
    change24h: numeric(row.price_change_percentage_24h),
    change7d: numeric(row.price_change_percentage_7d_in_currency),
    marketCap: numeric(row.market_cap),
    volume: numeric(row.total_volume),
    high24h: numeric(row.high_24h),
    low24h: numeric(row.low_24h),
    rank: numeric(row.market_cap_rank),
    circulatingSupply: numeric(row.circulating_supply),
    totalSupply: numeric(row.total_supply),
    maxSupply: numeric(row.max_supply),
    ath: numeric(row.ath),
    athDate: typeof row.ath_date === "string" ? row.ath_date : null,
    atl: numeric(row.atl),
    atlDate: typeof row.atl_date === "string" ? row.atl_date : null,
    lastUpdated: updated,
    sparkline: Array.isArray(sparkline?.price) ? sparkline.price.filter((p): p is number => typeof p === "number" && Number.isFinite(p) && p > 0) : [],
  };
}
export function quoteFromMarket(instrument: Instrument, market: CryptoMarketData, now = Date.now()): Quote {
  if (market.price === null || market.price <= 0) return unavailableQuote(instrument, "CoinGecko");
  const age = market.lastUpdated ? now - Date.parse(market.lastUpdated) : Infinity;
  return {
    ...unavailableQuote(instrument, "CoinGecko"),
    price: market.price,
    observedAt: market.lastUpdated,
    status: age >= -60_000 && age < 900_000 ? "live" : "stale",
    latency: "delayed",
    marketOpen: true,
    changePercent: market.change24h,
    change7dPercent: market.change7d,
    high: market.high24h,
    low: market.low24h,
    volume: market.volume,
    marketCap: market.marketCap,
    rank: market.rank,
    image: market.image,
    sparkline: market.sparkline,
  };
}
export function stripHtml(value: unknown): string {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}
