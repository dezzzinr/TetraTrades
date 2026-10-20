import { NextRequest, NextResponse } from "next/server";
import { supportedCoins, type ChartPeriod } from "@/lib/market";
import { getCoinCandles } from "@/lib/market-server";

export const dynamic = "force-dynamic";
const periods: ChartPeriod[] = ["24H", "7D", "30D", "1Y"];

export async function GET(request: NextRequest) {
  const periodParam = request.nextUrl.searchParams.get("period") ?? "7D";
  if (!periods.includes(periodParam as ChartPeriod)) {
    return NextResponse.json({ error: "Invalid chart period" }, { status: 400 });
  }
  const period = periodParam as ChartPeriod;
  const symbol = (request.nextUrl.searchParams.get("symbol") ?? "BTC").toUpperCase();
  if (!supportedCoins.some((coin) => coin.symbol === symbol)) {
    return NextResponse.json({ error: "Unsupported asset" }, { status: 400 });
  }
  try {
    const candles = await getCoinCandles(symbol, period);
    return NextResponse.json({ candles, period, symbol }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } });
  } catch (error) {
    console.error("Market candles unavailable:", error);
    return NextResponse.json({ error: "Candle data is temporarily unavailable. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
