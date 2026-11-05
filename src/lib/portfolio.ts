import { ASSET_CLASSES, getInstrument, type AssetClass } from "./instruments";
export type HoldingValue = { symbol: string; quantity: number; price: number | undefined };
export type ClassAllocation = { assetClass: AssetClass; label: string; color: string; value: number; percent: number };
export function groupHoldingsByClass(holdings: HoldingValue[]): ClassAllocation[] {
  const totals = new Map<AssetClass, number>();
  for (const holding of holdings) {
    const instrument = getInstrument(holding.symbol);
    if (!instrument || !Number.isFinite(holding.quantity) || holding.price === undefined || !Number.isFinite(holding.price)) continue;
    const value = holding.quantity * holding.price;
    if (value > 0) totals.set(instrument.assetClass, (totals.get(instrument.assetClass) ?? 0) + value);
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return ASSET_CLASSES.flatMap(info => {
    const value = totals.get(info.id) ?? 0;
    return value > 0 && total > 0 ? [{ assetClass: info.id, label: info.label, color: info.color, value, percent: value / total * 100 }] : [];
  });
}
