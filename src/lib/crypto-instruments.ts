import { instruments, type Instrument } from "./instruments";

export const DYNAMIC_CRYPTO_PREFIX = "cg:";
export const DYNAMIC_CRYPTO_ID_PREFIX = "crypto:cg:";
const legacyByProviderSymbol = new Map(instruments.filter(i => i.assetClass === "crypto").map(i => [i.providerSymbol, i] as const));

export type CryptoListRow = { id: string; symbol: string; name: string; platforms?: Record<string, string> | null };

export function isDynamicCryptoSymbol(symbol: string): boolean {
  return symbol.trim().toLowerCase().startsWith(DYNAMIC_CRYPTO_PREFIX);
}
export function isDynamicCryptoId(id: string): boolean {
  return id.startsWith(DYNAMIC_CRYPTO_ID_PREFIX);
}
export function coinGeckoIdFromSymbol(symbol: string): string | null {
  const value = symbol.trim().toLowerCase();
  return value.startsWith(DYNAMIC_CRYPTO_PREFIX) ? value.slice(DYNAMIC_CRYPTO_PREFIX.length) || null : null;
}
export function coinGeckoIdFromInstrumentId(id: string): string | null {
  return id.startsWith(DYNAMIC_CRYPTO_ID_PREFIX) ? id.slice(DYNAMIC_CRYPTO_ID_PREFIX.length) || null : null;
}

/** Legacy crypto keeps its original ticker/id. Every other listed coin gets a
 * collision-proof internal symbol because many unrelated tokens share tickers. */
export function cryptoInstrument(row: CryptoListRow): Instrument {
  const legacy = legacyByProviderSymbol.get(row.id);
  if (legacy) return legacy;
  const ticker = row.symbol.trim().toUpperCase() || row.id.toUpperCase();
  return {
    id: `${DYNAMIC_CRYPTO_ID_PREFIX}${row.id}`,
    symbol: `${DYNAMIC_CRYPTO_PREFIX}${row.id}`,
    displaySymbol: ticker,
    name: row.name,
    assetClass: "crypto",
    provider: "coingecko",
    providerSymbol: row.id,
    exchange: "Aggregated spot",
    quoteCurrency: "USD",
    unit: "coin",
    unitPlural: "coins",
    quantityStep: 0.00000001,
    minQuantity: 0.00000001,
    maxQuantity: 1_000_000_000_000,
    priceDecimals: 8,
    // Long-tail listings are spot-only in the simulator. The original eight
    // crypto markets keep their existing margin eligibility.
    tradable: true,
    marginEligible: false,
    marketSession: "continuous",
    valueKind: "price",
    description: `${row.name} / US dollar aggregated spot reference from CoinGecko. Paper trading only; availability depends on a fresh executable quote.`,
    relatedSymbols: [],
    color: "#7765e3",
    mark: ticker.slice(0, 3),
  };
}
