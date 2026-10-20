import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/market-server";
import { maybeSweepAll } from "@/lib/trading-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getMarketSnapshot();
  if (snapshot.status === "live") {
    const prices: Record<string, number> = {};
    for (const asset of snapshot.assets) prices[asset.symbol] = asset.price;
    // No-ops unless the cooldown has elapsed (most polls skip straight
    // through), and swallows its own errors - awaited rather than
    // fire-and-forget so it still runs reliably on serverless hosts that
    // freeze the function as soon as the response is sent.
    await maybeSweepAll(prices);
  }
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": snapshot.status === "live"
        ? "public, s-maxage=45, stale-while-revalidate=15"
        : "no-store",
    },
  });
}
