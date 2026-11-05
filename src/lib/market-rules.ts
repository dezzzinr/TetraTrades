import type { Instrument } from "./instruments";

export type QuoteStatus = "live" | "demo" | "closed" | "stale" | "unavailable";
export type FeedLatency = "real_time" | "delayed" | "end_of_day" | "unknown" | "demo";
export type Quote = {
  instrumentId: string;
  price: number | null;
  observedAt: string | null;
  status: QuoteStatus;
  latency: FeedLatency;
  marketOpen: boolean | null;
  changePercent: number | null;
  change7dPercent: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  marketCap: number | null;
  sparkline: number[];
  rank: number | null;
  image: string | null;
  source: string;
};
export type ExecutionPolicy = { allowDelayedPaperFills: boolean; maxQuoteAgeMs: number };
export const DEFAULT_MAX_QUOTE_AGE_MS = 15 * 60 * 1000;

/** Execution uses the provider's observation time, never the HTTP cache time. */
export function executionGate(instrument: Instrument, quote: Quote | undefined, policy: ExecutionPolicy, now = Date.now()): string | null {
  if (!instrument.tradable) return instrument.assetClass === "bond"
    ? "Bond yields are reference-only. Explore a bond ETF for simulated exposure."
    : "An index is a benchmark, not a tradable instrument. Explore a related ETF.";
  if (!quote || quote.price === null || !Number.isFinite(quote.price) || quote.price <= 0) return "A usable market quote is unavailable for this instrument.";
  if (instrument.quoteCurrency !== "USD") return "This instrument needs settlement-currency conversion before paper trading can be enabled.";
  if (quote.status === "unavailable") return "Market data is unavailable for this instrument.";
  if (quote.status === "demo") return null;
  if (instrument.marketSession === "provider" && quote.marketOpen !== true) return "The market is closed or its session status is unknown. New paper fills are paused.";
  if (!quote.observedAt || !Number.isFinite(Date.parse(quote.observedAt))) return "The quote has no verifiable observation time.";
  const age = now - Date.parse(quote.observedAt);
  if (age < -60_000 || age > policy.maxQuoteAgeMs) return "The quote is stale or outside the accepted time window.";
  if (quote.status !== "live") return "This quote is not eligible for execution.";
  if (quote.latency === "unknown") return "The feed's latency is unverified. Configure the latency included in your data entitlement before enabling paper fills.";
  if (quote.latency !== "real_time" && !policy.allowDelayedPaperFills) return "Delayed paper fills are disabled. Enable them explicitly or use a real-time entitlement.";
  return null;
}

/** Decimal-step validation without accepting floating-point residue as a valid quantity. */
export function validateQuantity(instrument: Instrument, quantity: number): string | null {
  if (!Number.isFinite(quantity) || quantity < instrument.minQuantity || quantity > instrument.maxQuantity) {
    return `Enter a quantity from ${instrument.minQuantity} to ${instrument.maxQuantity.toLocaleString("en-US")} ${instrument.unitPlural}.`;
  }
  const steps = quantity / instrument.quantityStep;
  if (Math.abs(steps - Math.round(steps)) > 0.00001) return `Quantity must increase in steps of ${instrument.quantityStep} ${instrument.unitPlural}.`;
  return null;
}
export function floorQuantity(instrument: Instrument, quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  const steps = Math.floor(quantity / instrument.quantityStep + 1e-9);
  return Number((steps * instrument.quantityStep).toFixed(8));
}
export function validateSpotRequest(instrument: Instrument | undefined, side: unknown, quantity: number): string | null {
  if (!instrument) return "Choose a supported instrument.";
  if (!instrument.tradable) return executionGate(instrument, undefined, { allowDelayedPaperFills: false, maxQuoteAgeMs: DEFAULT_MAX_QUOTE_AGE_MS });
  if (side !== "buy" && side !== "sell") return "Choose buy or sell.";
  return validateQuantity(instrument, quantity);
}
export function quoteChangeLabel(instrument: Instrument): string {
  return instrument.assetClass === "crypto" ? "24h change" : instrument.valueKind === "yield" ? "Yield change (pp)" : "Session change";
}
