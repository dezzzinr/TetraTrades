import type { Instrument } from "./instruments";
import type { Asset } from "./market";
import { formatMarketPrice } from "./currency";

export function formatAssetValue(instrument: Instrument, value: number | null | undefined, currency = "USD", rate = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (instrument.valueKind === "yield") return `${value.toFixed(3)}%`;
  if (instrument.valueKind === "index") return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return formatMarketPrice(value, currency, rate);
}
export function formatAssetChange(instrument: Instrument, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(instrument.valueKind === "yield" ? 3 : 2)}${instrument.valueKind === "yield" ? " pp" : "%"}`;
}
export function feedLabel(asset: Asset): string {
  if (asset.quoteStatus === "demo") return "Demo";
  if (asset.quoteStatus === "unavailable") return "Offline";
  if (asset.quoteStatus === "stale") return "Stale";
  if (asset.valueKind === "yield") return "Daily";
  if (asset.quoteStatus === "closed") return "Closed";
  if (asset.latency === "delayed") return "Delayed";
  if (asset.latency === "unknown") return "Unverified";
  return "Fresh";
}
