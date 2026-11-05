/** Versioned instrument identities. Tickers are display labels, not database keys.
 * The starter cash instruments are all USD-quoted. Never add a non-USD quote
 * without implementing settlement-currency conversion in the trading engine.
 */
export const ASSET_CLASSES = [
  { id: "crypto", label: "Crypto", plural: "Crypto", color: "#7765e3", description: "Digital assets, valued in USD." },
  { id: "stock", label: "Stocks", plural: "Stocks", color: "#3936ee", description: "US company shares. Paper fills use whole shares." },
  { id: "forex", label: "Forex", plural: "Forex", color: "#169c91", description: "USD-quoted currency pairs. Size is in base-currency units, not lots." },
  { id: "commodity", label: "Commodities", plural: "Commodities", color: "#d49a29", description: "Indicative spot markets—not futures contracts or physical delivery." },
  { id: "index", label: "Indices", plural: "Indices", color: "#4f86ec", description: "Reference benchmarks. Explore related ETFs for simulated investment exposure." },
  { id: "etf", label: "ETFs", plural: "ETFs", color: "#dc6d91", description: "Exchange-traded funds, including equity-index and bond funds." },
  { id: "bond", label: "Bonds", plural: "Bonds", color: "#65758b", description: "Government-bond yield benchmarks, not individual bonds or executable prices." },
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number]["id"];
export type ProviderId = "coingecko" | "twelvedata" | "eodhd";
export type Instrument = {
  id: string;
  symbol: string;
  displaySymbol: string;
  name: string;
  assetClass: AssetClass;
  provider: ProviderId;
  providerSymbol: string;
  exchange: string;
  micCode?: string;
  country?: string;
  providerType?: string;
  quoteCurrency: "USD";
  unit: string;
  unitPlural: string;
  quantityStep: number;
  minQuantity: number;
  maxQuantity: number;
  priceDecimals: number;
  tradable: boolean;
  marginEligible: boolean;
  marketSession: "continuous" | "provider";
  valueKind: "price" | "yield" | "index";
  description: string;
  relatedSymbols: readonly string[];
  color: string;
  mark: string;
};

type Entry = Pick<Instrument, "id" | "symbol" | "name" | "assetClass" | "provider" | "providerSymbol" | "description"> & Partial<Instrument>;
const classDefaults: Record<AssetClass, Pick<Instrument, "color" | "mark" | "unit" | "unitPlural" | "quantityStep" | "minQuantity" | "priceDecimals" | "tradable" | "marginEligible" | "marketSession" | "valueKind">> = {
  crypto: { color: "#7765e3", mark: "C", unit: "coin", unitPlural: "coins", quantityStep: 0.00000001, minQuantity: 0.00000001, priceDecimals: 8, tradable: true, marginEligible: true, marketSession: "continuous", valueKind: "price" },
  stock: { color: "#3936ee", mark: "S", unit: "share", unitPlural: "shares", quantityStep: 1, minQuantity: 1, priceDecimals: 2, tradable: true, marginEligible: false, marketSession: "provider", valueKind: "price" },
  etf: { color: "#dc6d91", mark: "F", unit: "share", unitPlural: "shares", quantityStep: 1, minQuantity: 1, priceDecimals: 2, tradable: true, marginEligible: false, marketSession: "provider", valueKind: "price" },
  forex: { color: "#169c91", mark: "FX", unit: "base unit", unitPlural: "base units", quantityStep: 1, minQuantity: 1000, priceDecimals: 5, tradable: true, marginEligible: false, marketSession: "provider", valueKind: "price" },
  commodity: { color: "#d49a29", mark: "M", unit: "unit", unitPlural: "units", quantityStep: 0.001, minQuantity: 0.001, priceDecimals: 3, tradable: true, marginEligible: false, marketSession: "provider", valueKind: "price" },
  index: { color: "#4f86ec", mark: "I", unit: "index level", unitPlural: "index points", quantityStep: 1, minQuantity: 1, priceDecimals: 2, tradable: false, marginEligible: false, marketSession: "provider", valueKind: "index" },
  bond: { color: "#65758b", mark: "%", unit: "yield (%)", unitPlural: "yield (%)", quantityStep: 1, minQuantity: 1, priceDecimals: 3, tradable: false, marginEligible: false, marketSession: "provider", valueKind: "yield" },
};
function entry(value: Entry): Instrument {
  return {
    ...classDefaults[value.assetClass], displaySymbol: value.symbol, exchange: "—", quoteCurrency: "USD",
    maxQuantity: 1_000_000, relatedSymbols: [], ...value,
  };
}

export const instruments: readonly Instrument[] = [
  entry({ id: "crypto:BTC", symbol: "BTC", name: "Bitcoin", assetClass: "crypto", provider: "coingecko", providerSymbol: "bitcoin", exchange: "Aggregated spot", color: "#F7931A", mark: "₿", description: "Bitcoin / US dollar aggregated spot reference." }),
  entry({ id: "crypto:ETH", symbol: "ETH", name: "Ethereum", assetClass: "crypto", provider: "coingecko", providerSymbol: "ethereum", exchange: "Aggregated spot", color: "#627EEA", mark: "◆", description: "Ethereum / US dollar aggregated spot reference." }),
  entry({ id: "crypto:SOL", symbol: "SOL", name: "Solana", assetClass: "crypto", provider: "coingecko", providerSymbol: "solana", exchange: "Aggregated spot", color: "#8B5CF6", mark: "≋", description: "Solana / US dollar aggregated spot reference." }),
  entry({ id: "crypto:BNB", symbol: "BNB", name: "BNB", assetClass: "crypto", provider: "coingecko", providerSymbol: "binancecoin", exchange: "Aggregated spot", color: "#F3BA2F", mark: "✦", description: "BNB / US dollar aggregated spot reference." }),
  entry({ id: "crypto:AVAX", symbol: "AVAX", name: "Avalanche", assetClass: "crypto", provider: "coingecko", providerSymbol: "avalanche-2", exchange: "Aggregated spot", color: "#E84142", mark: "▲", description: "Avalanche / US dollar aggregated spot reference." }),
  entry({ id: "crypto:LINK", symbol: "LINK", name: "Chainlink", assetClass: "crypto", provider: "coingecko", providerSymbol: "chainlink", exchange: "Aggregated spot", color: "#2A5ADA", mark: "⬡", description: "Chainlink / US dollar aggregated spot reference." }),
  entry({ id: "crypto:ADA", symbol: "ADA", name: "Cardano", assetClass: "crypto", provider: "coingecko", providerSymbol: "cardano", exchange: "Aggregated spot", color: "#3468D1", mark: "✳", description: "Cardano / US dollar aggregated spot reference." }),
  entry({ id: "crypto:DOGE", symbol: "DOGE", name: "Dogecoin", assetClass: "crypto", provider: "coingecko", providerSymbol: "dogecoin", exchange: "Aggregated spot", color: "#C2A633", mark: "Ð", description: "Dogecoin / US dollar aggregated spot reference." }),
  ...[
    ["AAPL", "Apple", "XNAS", "Technology and consumer devices."],
    ["MSFT", "Microsoft", "XNAS", "Software, cloud services, and enterprise technology."],
    ["NVDA", "NVIDIA", "XNAS", "Accelerated computing and graphics technology."],
    ["AMZN", "Amazon", "XNAS", "E-commerce and cloud services."],
    ["GOOGL", "Alphabet · Class A", "XNAS", "Search, advertising, and internet services."],
    ["TSLA", "Tesla", "XNAS", "Electric vehicles and energy technology."],
  ].map(([symbol, name, micCode, description]) => entry({ id: `stock:${micCode}:${symbol}`, symbol, name, assetClass: "stock", provider: "twelvedata", providerSymbol: symbol, micCode, exchange: "NASDAQ", country: "US", description })),
  entry({ id: "etf:ARCX:SPY", symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetClass: "etf", provider: "twelvedata", providerSymbol: "SPY", micCode: "ARCX", exchange: "NYSE Arca", country: "US", mark: "500", relatedSymbols: ["SPX"], description: "Equity-index ETF tracking the S&P 500. An ETF share is not the index itself." }),
  entry({ id: "etf:XNAS:QQQ", symbol: "QQQ", name: "Invesco QQQ Trust", assetClass: "etf", provider: "twelvedata", providerSymbol: "QQQ", micCode: "XNAS", exchange: "NASDAQ", country: "US", mark: "100", relatedSymbols: ["IXIC"], description: "Equity-index ETF tracking the Nasdaq-100, not the Nasdaq Composite benchmark shown alongside it." }),
  entry({ id: "etf:XNAS:TLT", symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", assetClass: "etf", provider: "twelvedata", providerSymbol: "TLT", micCode: "XNAS", exchange: "NASDAQ", country: "US", mark: "20+", relatedSymbols: ["US20Y", "US30Y"], description: "Long-dated US Treasury bond ETF. Its share price can fall when yields rise; it is not a guaranteed bond principal." }),
  entry({ id: "etf:ARCX:AGG", symbol: "AGG", name: "iShares Core US Aggregate Bond ETF", assetClass: "etf", provider: "twelvedata", providerSymbol: "AGG", micCode: "ARCX", exchange: "NYSE Arca", country: "US", mark: "AG", relatedSymbols: ["US2Y", "US10Y"], description: "Diversified USD investment-grade bond ETF. Bond-fund exposure, not ownership of a benchmark yield." }),
  ...[["EUR", "Euro", "€"], ["GBP", "British pound", "£"], ["AUD", "Australian dollar", "A$"], ["NZD", "New Zealand dollar", "NZ$"]].map(([code, name, mark]) => entry({ id: `forex:${code}USD`, symbol: `${code}USD`, displaySymbol: `${code}/USD`, name: `${name} / US dollar`, assetClass: "forex", provider: "twelvedata", providerSymbol: `${code}/USD`, exchange: "Interbank reference", mark, description: `Simulated ${name.toLowerCase()} exposure. One unit is one ${code}; this is not a standardized lot or a deliverable FX contract.` })),
  entry({ id: "commodity:XAUUSD", symbol: "XAUUSD", displaySymbol: "XAU/USD", name: "Gold spot", assetClass: "commodity", provider: "twelvedata", providerSymbol: "XAU/USD", exchange: "Spot reference", mark: "Au", unit: "troy ounce", unitPlural: "troy ounces", description: "Indicative gold spot reference in USD per troy ounce. No futures expiry or physical delivery." }),
  entry({ id: "commodity:XAGUSD", symbol: "XAGUSD", displaySymbol: "XAG/USD", name: "Silver spot", assetClass: "commodity", provider: "twelvedata", providerSymbol: "XAG/USD", exchange: "Spot reference", mark: "Ag", unit: "troy ounce", unitPlural: "troy ounces", description: "Indicative silver spot reference in USD per troy ounce. No futures expiry or physical delivery." }),
  entry({ id: "commodity:WTIUSD", symbol: "WTIUSD", displaySymbol: "WTI/USD", name: "WTI crude oil spot", assetClass: "commodity", provider: "twelvedata", providerSymbol: "WTI/USD", exchange: "Spot reference", mark: "Oil", unit: "barrel", unitPlural: "barrels", priceDecimals: 2, description: "Indicative WTI spot reference in USD per barrel, not a CME futures contract." }),
  entry({ id: "commodity:XBRUSD", symbol: "XBRUSD", displaySymbol: "XBR/USD", name: "Brent crude oil spot", assetClass: "commodity", provider: "twelvedata", providerSymbol: "XBR/USD", exchange: "Spot reference", mark: "Brt", unit: "barrel", unitPlural: "barrels", priceDecimals: 2, description: "Indicative Brent spot reference in USD per barrel, not an ICE futures contract." }),
  entry({ id: "index:US:SPX", symbol: "SPX", name: "S&P 500", assetClass: "index", provider: "twelvedata", providerSymbol: "SPX", providerType: "Index", country: "US", exchange: "US benchmark", mark: "500", relatedSymbols: ["SPY"], description: "US large-cap equity benchmark. Reference only; SPY is a separate tradable ETF in this simulator." }),
  entry({ id: "index:US:IXIC", symbol: "IXIC", name: "Nasdaq Composite", assetClass: "index", provider: "twelvedata", providerSymbol: "IXIC", providerType: "Index", country: "US", exchange: "NASDAQ benchmark", mark: "NQ", relatedSymbols: ["QQQ"], description: "Broad Nasdaq equity benchmark. QQQ tracks the different Nasdaq-100 index." }),
  entry({ id: "index:US:DJI", symbol: "DJI", name: "Dow Jones Industrial Average", assetClass: "index", provider: "twelvedata", providerSymbol: "DJI", providerType: "Index", country: "US", exchange: "US benchmark", mark: "30", description: "Price-weighted benchmark of 30 US companies. Index levels cannot be purchased directly." }),
  ...[["US2Y", "US 2-year government bond", "2Y"], ["US10Y", "US 10-year government bond", "10Y"], ["US20Y", "US 20-year government bond", "20Y"], ["US30Y", "US 30-year government bond", "30Y"]].map(([symbol, name, mark]) => entry({ id: `bond:${symbol}`, symbol, name, assetClass: "bond", provider: "eodhd", providerSymbol: `${symbol}.GBOND`, exchange: "Government yield series", mark, relatedSymbols: symbol === "US2Y" ? ["AGG"] : ["TLT", "AGG"], description: "Daily government-bond yield in percent. Not a bond price, total return, or executable instrument. Use a bond ETF for simulated exposure." })),
];

const byId = new Map(instruments.map((item) => [item.id, item]));
const bySymbol = new Map(instruments.flatMap((item) => [[item.symbol, item] as const, [item.displaySymbol, item] as const]));
export function getInstrument(symbol: string): Instrument | undefined { return bySymbol.get(symbol.trim().toUpperCase()); }
export function getInstrumentById(id: string): Instrument | undefined { return byId.get(id); }
export function resolveInstrument(symbol: string, instrumentId?: string | null): Instrument | undefined {
  // Legacy rows have no instrument_id; their ticker remains the compatibility key.
  return instrumentId ? getInstrumentById(instrumentId) : getInstrument(symbol);
}
export function classInfo(id: AssetClass) { return ASSET_CLASSES.find((item) => item.id === id)!; }
export const tradableInstruments = instruments.filter((item) => item.tradable);
export function quantityLabel(instrument: Instrument, quantity: number): string {
  return `${quantity.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${Math.abs(quantity) === 1 ? instrument.unit : instrument.unitPlural}`;
}
