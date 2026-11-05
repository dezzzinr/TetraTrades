import "server-only";
import type { Instrument } from "./instruments";
import { floorQuantity, validateSpotRequest } from "./market-rules";
import { getAssetForInstrument, requireExecutableQuote } from "./market-server";
import { resolveServerInstrument } from "./crypto-catalog";

export async function tradableInstrument(symbol: string, instrumentId?: string | null): Promise<Instrument> {
  const instrument = await resolveServerInstrument(symbol, instrumentId);
  const error = validateSpotRequest(instrument, "buy", instrument?.minQuantity ?? 1);
  if (!instrument || error) throw new Error(error ?? "Choose a tradable instrument.");
  return instrument;
}
export function spotQuantity(instrument: Instrument, side: unknown, body: Record<string, unknown>, priceUsd: number, budgetUsd?: number): number {
  const hasBudget = body.amount !== undefined && body.amount !== null && body.amount !== "";
  const quantity = hasBudget ? floorQuantity(instrument, (budgetUsd ?? 0) / priceUsd) : Number(body.quantity);
  const error = validateSpotRequest(instrument, side, quantity);
  if (error) throw new Error(error);
  return quantity;
}
export async function executableAsset(symbol: string, instrumentId?: string | null) {
  const instrument = await tradableInstrument(symbol, instrumentId);
  const asset = await getAssetForInstrument(instrument);
  requireExecutableQuote(asset);
  return { instrument, asset };
}
