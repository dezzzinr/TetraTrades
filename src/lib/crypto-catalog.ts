import "server-only";
import { and, asc, desc, eq, ilike, inArray, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { cryptoAssets, marketCache, holdings, orders, positions, watchlistItems, priceAlerts } from "@/db/schema";
import { emptyAsset, type Asset } from "./market";
import { getInstrument, resolveInstrument, type Instrument } from "./instruments";
import { cryptoInstrument, coinGeckoIdFromInstrumentId, coinGeckoIdFromSymbol, isDynamicCryptoId, isDynamicCryptoSymbol, type CryptoListRow } from "./crypto-instruments";
import { coingeckoRequest } from "./providers/coingecko-client";
import { mapMarketRow, quoteFromMarket, safeImage, stripHtml, type CryptoMarketData, type RawCoinMarket } from "./providers/coingecko-map";

const CATALOG_KEY = "coingecko:coins:list";
const CATALOG_TTL_MS = 24 * 3600_000;
const MARKET_TTL_MS = 60_000;

async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const [row] = await db.select().from(marketCache).where(eq(marketCache.key, key)).limit(1);
  if (row && Date.now() - row.fetchedAt.getTime() < ttlMs) return row.data as T;
  const data = await loader();
  await db.insert(marketCache).values({ key, data: data as Record<string, unknown>, fetchedAt: new Date() })
    .onConflictDoUpdate({ target: marketCache.key, set: { data: data as Record<string, unknown>, fetchedAt: new Date() } });
  return data;
}

export async function ensureCryptoCatalog(force = false): Promise<number> {
  if (!force) {
    const [meta] = await db.select().from(marketCache).where(eq(marketCache.key, CATALOG_KEY)).limit(1);
    if (meta && Date.now() - meta.fetchedAt.getTime() < CATALOG_TTL_MS) return Number((meta.data as { count?: number }).count ?? 0);
  }
  const raw = await coingeckoRequest<unknown>("/coins/list?include_platform=true", 0);
  if (!Array.isArray(raw)) throw new Error("CoinGecko returned an invalid coin list");
  const rows = raw.flatMap((value): CryptoListRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.symbol !== "string" || typeof row.name !== "string" || !row.id) return [];
    const platforms = row.platforms && typeof row.platforms === "object" && !Array.isArray(row.platforms) ? row.platforms as Record<string, string> : null;
    return [{ id: row.id, symbol: row.symbol, name: row.name, platforms }];
  });
  const now = new Date();
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500).map(row => ({ id: row.id, symbol: row.symbol, name: row.name, platforms: row.platforms, active: true, listedSyncedAt: now, updatedAt: now }));
    await db.insert(cryptoAssets).values(batch).onConflictDoUpdate({
      target: cryptoAssets.id,
      set: { symbol: sql`excluded.symbol`, name: sql`excluded.name`, platforms: sql`excluded.platforms`, active: true, listedSyncedAt: now, updatedAt: now },
    });
  }
  await db.insert(marketCache).values({ key: CATALOG_KEY, data: { count: rows.length }, fetchedAt: now })
    .onConflictDoUpdate({ target: marketCache.key, set: { data: { count: rows.length }, fetchedAt: now } });
  return rows.length;
}

export function assetFromCryptoMarket(instrument: Instrument, market: CryptoMarketData | null, image?: string | null): Asset {
  const base = emptyAsset(instrument);
  if (!market) return { ...base, image: image ?? base.image };
  const quote = quoteFromMarket(instrument, market);
  return {
    ...base,
    image: market.image ?? image ?? null,
    price: quote.price ?? 0,
    change: quote.changePercent ?? 0,
    change7d: quote.change7dPercent ?? 0,
    volumeUsd: quote.volume ?? 0,
    rawVolume: quote.volume ?? 0,
    capUsd: quote.marketCap ?? 0,
    chart: quote.sparkline,
    rank: quote.rank,
    high24h: quote.high,
    low24h: quote.low,
    updatedAt: quote.observedAt,
    quoteStatus: quote.status,
    latency: quote.latency,
    marketOpen: quote.marketOpen,
    source: "CoinGecko",
  };
}

async function upsertMarkets(rows: CryptoMarketData[]) {
  const now = new Date();
  for (let i = 0; i < rows.length; i += 250) {
    const batch = rows.slice(i, i + 250).map(row => ({
      id: row.id, symbol: row.symbol || row.id, name: row.name || row.id, image: row.image,
      marketCapRank: row.rank === null ? null : Math.round(row.rank), marketData: row as unknown as Record<string, unknown>,
      marketUpdatedAt: now, active: true, updatedAt: now,
    }));
    if (!batch.length) continue;
    await db.insert(cryptoAssets).values(batch).onConflictDoUpdate({
      target: cryptoAssets.id,
      set: {
        symbol: sql`excluded.symbol`, name: sql`excluded.name`,
        image: sql`coalesce(excluded.image, ${cryptoAssets.image})`,
        marketCapRank: sql`coalesce(excluded.market_cap_rank, ${cryptoAssets.marketCapRank})`,
        marketData: sql`excluded.market_data`, marketUpdatedAt: now, active: true, updatedAt: now,
      },
    });
  }
}

export async function hydrateCryptoMarkets(ids: string[], force = false): Promise<Map<string, CryptoMarketData>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const result = new Map<string, CryptoMarketData>();
  if (!unique.length) return result;
  const rows = await db.select().from(cryptoAssets).where(inArray(cryptoAssets.id, unique));
  const stale: string[] = [];
  for (const id of unique) {
    const row = rows.find(r => r.id === id);
    const market = row?.marketData as CryptoMarketData | null | undefined;
    if (!force && market && row?.marketUpdatedAt && Date.now() - row.marketUpdatedAt.getTime() < MARKET_TTL_MS) result.set(id, market);
    else stale.push(id);
  }
  for (let i = 0; i < stale.length; i += 100) {
    const batch = stale.slice(i, i + 100);
    const query = new URLSearchParams({ vs_currency: "usd", ids: batch.join(","), per_page: String(batch.length), page: "1", sparkline: "true", price_change_percentage: "24h,7d" });
    const raw = await coingeckoRequest<unknown>(`/coins/markets?${query}`, 60);
    if (!Array.isArray(raw)) continue;
    const mapped = raw.flatMap(row => { const market = mapMarketRow(row as RawCoinMarket); return market ? [market] : []; });
    await upsertMarkets(mapped);
    for (const market of mapped) result.set(market.id, market);
  }
  return result;
}

export type CryptoPage = { assets: Asset[]; total: number | null; page: number; perPage: number; updatedAt: string };
export async function getCryptoAssetsPage(options: { search?: string; page?: number; perPage?: number; category?: string; order?: string } = {}): Promise<CryptoPage> {
  await ensureCryptoCatalog();
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const perPage = Math.min(100, Math.max(1, Math.floor(options.perPage ?? 50)));
  const order = options.order ?? "market_cap_desc";
  const search = (options.search ?? "").trim();
  if (!search && !options.category && order !== "name_asc") {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(cryptoAssets).where(eq(cryptoAssets.active, true));
    const query = new URLSearchParams({ vs_currency: "usd", order, per_page: String(perPage), page: String(page), sparkline: "true", price_change_percentage: "24h,7d" });
    const raw = await coingeckoRequest<unknown>(`/coins/markets?${query}`, 60);
    const markets = Array.isArray(raw) ? raw.flatMap(row => { const market = mapMarketRow(row as RawCoinMarket); return market ? [market] : []; }) : [];
    await upsertMarkets(markets);
    const assets = markets.map(market => assetFromCryptoMarket(cryptoInstrument({ id: market.id, symbol: market.symbol, name: market.name }), market));
    return { assets, total: count, page, perPage, updatedAt: new Date().toISOString() };
  }
  if (options.category) {
    const query = new URLSearchParams({ vs_currency: "usd", category: options.category, order: order === "name_asc" ? "market_cap_desc" : order, per_page: String(perPage), page: String(page), sparkline: "true", price_change_percentage: "24h,7d" });
    const raw = await coingeckoRequest<unknown>(`/coins/markets?${query}`, 60);
    const markets = Array.isArray(raw) ? raw.flatMap(row => { const market = mapMarketRow(row as RawCoinMarket); return market ? [market] : []; }) : [];
    await upsertMarkets(markets);
    const assets = markets.map(market => assetFromCryptoMarket(cryptoInstrument({ id: market.id, symbol: market.symbol, name: market.name }), market));
    return { assets, total: null, page, perPage, updatedAt: new Date().toISOString() };
  }
  const where = and(eq(cryptoAssets.active, true), search ? or(ilike(cryptoAssets.id, `%${search}%`), ilike(cryptoAssets.symbol, `%${search}%`), ilike(cryptoAssets.name, `%${search}%`)) : undefined);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(cryptoAssets).where(where);
  const orderBy = order === "name_asc" ? [asc(cryptoAssets.name)] : order === "market_cap_asc" ? [desc(cryptoAssets.marketCapRank), asc(cryptoAssets.id)] : [asc(cryptoAssets.marketCapRank), asc(cryptoAssets.id)];
  const rows = await db.select().from(cryptoAssets).where(where).orderBy(...orderBy).limit(perPage).offset((page - 1) * perPage);
  const markets = await hydrateCryptoMarkets(rows.map(row => row.id));
  const assets = rows.map(row => assetFromCryptoMarket(cryptoInstrument(row), markets.get(row.id) ?? null, row.image));
  return { assets, total: count, page, perPage, updatedAt: new Date().toISOString() };
}

export async function getCryptoCoin(id: string) {
  await ensureCryptoCatalog();
  const [row] = await db.select().from(cryptoAssets).where(eq(cryptoAssets.id, id)).limit(1);
  const detail = await cached<Record<string, unknown>>(`coingecko:coin:${id}`, 300_000, () => coingeckoRequest<Record<string, unknown>>(`/coins/${encodeURIComponent(id)}?localization=false&tickers=true&market_data=true&community_data=false&developer_data=false&sparkline=true`, 300));
  const markets = await hydrateCryptoMarkets([id], true);
  const listRow = row ?? { id, symbol: String(detail.symbol ?? id), name: String(detail.name ?? id) };
  const instrument = cryptoInstrument(listRow);
  const asset = assetFromCryptoMarket(instrument, markets.get(id) ?? null, row?.image ?? safeImage((detail.image as Record<string, unknown> | undefined)?.large));
  const links = detail.links as Record<string, unknown> | undefined;
  const tickers = Array.isArray(detail.tickers) ? detail.tickers.slice(0, 25) : [];
  return {
    asset,
    detail: {
      id, description: stripHtml((detail.description as Record<string, unknown> | undefined)?.en).slice(0, 1200),
      categories: Array.isArray(detail.categories) ? detail.categories.filter((c): c is string => typeof c === "string") : [],
      platforms: detail.platforms && typeof detail.platforms === "object" ? detail.platforms as Record<string, string> : {},
      homepage: Array.isArray(links?.homepage) ? links.homepage.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 3) : [],
      blockchainSites: Array.isArray(links?.blockchain_site) ? links.blockchain_site.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 3) : [],
      tickers,
    },
  };
}

export async function getCryptoDiscovery() {
  const [trending, categories, exchanges, global] = await Promise.all([
    cached<Record<string, unknown>>("coingecko:trending", 300_000, () => coingeckoRequest<Record<string, unknown>>("/search/trending", 300)),
    cached<unknown[]>("coingecko:categories", 3600_000, () => coingeckoRequest<unknown[]>("/coins/categories", 3600)),
    cached<unknown[]>("coingecko:exchanges", 3600_000, () => coingeckoRequest<unknown[]>("/exchanges?per_page=50&page=1", 3600)),
    cached<Record<string, unknown>>("coingecko:global", 120_000, () => coingeckoRequest<Record<string, unknown>>("/global", 120)),
  ]);
  const trendingCoins = Array.isArray(trending.coins) ? trending.coins.flatMap((value) => {
    const item = (value as Record<string, unknown>)?.item as Record<string, unknown> | undefined;
    return item && typeof item.id === "string" ? [{ id: item.id, name: String(item.name ?? item.id), symbol: String(item.symbol ?? ""), image: safeImage(item.large) ?? safeImage(item.small) ?? safeImage(item.thumb), rank: typeof item.market_cap_rank === "number" ? item.market_cap_rank : null }] : [];
  }) : [];
  const markets = await hydrateCryptoMarkets(trendingCoins.map(coin => coin.id));
  return {
    trending: trendingCoins.map(coin => ({ ...coin, asset: assetFromCryptoMarket(cryptoInstrument({ id: coin.id, symbol: coin.symbol, name: coin.name }), markets.get(coin.id) ?? null, coin.image) })),
    categories: Array.isArray(categories) ? categories.slice(0, 100) : [],
    exchanges: Array.isArray(exchanges) ? exchanges.slice(0, 50) : [],
    global: (global.data ?? global) as Record<string, unknown>,
    updatedAt: new Date().toISOString(),
  };
}

export async function resolveServerInstrument(symbol: string, instrumentId?: string | null): Promise<Instrument | undefined> {
  const dynamicId = instrumentId && isDynamicCryptoId(instrumentId) ? coinGeckoIdFromInstrumentId(instrumentId) : coinGeckoIdFromSymbol(symbol);
  if (!dynamicId) {
    const instrument = resolveInstrument(symbol, instrumentId) ?? getInstrument(symbol);
    return instrumentId && instrument?.id !== instrumentId ? undefined : instrument;
  }
  let [row] = await db.select().from(cryptoAssets).where(eq(cryptoAssets.id, dynamicId)).limit(1);
  if (!row) {
    await ensureCryptoCatalog();
    [row] = await db.select().from(cryptoAssets).where(eq(cryptoAssets.id, dynamicId)).limit(1);
  }
  if (!row || !row.active) return undefined;
  const instrument = cryptoInstrument(row);
  if (instrumentId && instrument.id !== instrumentId) return undefined;
  return instrument;
}

export async function getTrackedDynamicInstruments(limit = 300): Promise<Instrument[]> {
  const tables = [holdings.symbol, orders.symbol, positions.symbol, watchlistItems.symbol, priceAlerts.symbol];
  const symbols = new Set<string>();
  for (const column of tables) {
    const rows = await db.selectDistinct({ symbol: column }).from(column.table).where(like(column, "cg:%")).limit(limit);
    for (const row of rows) symbols.add(row.symbol);
    if (symbols.size >= limit) break;
  }
  const ids = [...symbols].slice(0, limit).map(coinGeckoIdFromSymbol).filter((id): id is string => !!id);
  if (!ids.length) return [];
  const rows = await db.select().from(cryptoAssets).where(and(inArray(cryptoAssets.id, ids), eq(cryptoAssets.active, true)));
  return rows.map(cryptoInstrument);
}
