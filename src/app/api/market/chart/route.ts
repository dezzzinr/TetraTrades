import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { holdings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { supportedCoins, type Asset, type ChartPeriod, type ChartPoint } from "@/lib/market";
import { getCoinHistory, getMarketSnapshot } from "@/lib/market-server";

export const dynamic = "force-dynamic";
const periods: ChartPeriod[] = ["24H", "7D", "30D", "1Y"];
const rangeMs: Record<ChartPeriod, number> = { "24H": 86400000, "7D": 7 * 86400000, "30D": 30 * 86400000, "1Y": 365 * 86400000 };

function sparklineHistory(asset: Asset, period: "24H" | "7D"): ChartPoint[] {
  const prices = asset.chart.slice(period === "24H" ? -25 : -168);
  if (prices.length < 2 || !asset.updatedAt) throw new Error("Sparkline unavailable");
  const asOf = Date.parse(asset.updatedAt);
  return prices.map((price, index) => ({ timestamp: asOf - (prices.length - 1 - index) * 3600000, price }));
}

function nearestPrice(points: ChartPoint[], at: number) {
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].timestamp < at) low = mid + 1;
    else high = mid;
  }
  const previous = Math.max(0, low - 1);
  return Math.abs(points[low].timestamp - at) < Math.abs(points[previous].timestamp - at)
    ? points[low].price
    : points[previous].price;
}

export async function GET(request: NextRequest) {
  const periodParam = request.nextUrl.searchParams.get("period") ?? "7D";
  if (!periods.includes(periodParam as ChartPeriod)) {
    return NextResponse.json({ error: "Invalid chart period" }, { status: 400 });
  }
  const period = periodParam as ChartPeriod;
  const mode = request.nextUrl.searchParams.get("mode");

  try {
    if (mode === "portfolio") {
      const user = await getUser(request);
      if (!user) return NextResponse.json({ error: "Please refresh your session" }, { status: 401 });
      const positions = (await db.select().from(holdings).where(eq(holdings.userId, user.id)))
        .filter((position) => Number(position.quantity) > 0 && supportedCoins.some((coin) => coin.symbol === position.symbol));
      if (positions.length === 0) {
        const now = Date.now();
        return NextResponse.json({
          points: [{ timestamp: now - rangeMs[period], price: Number(user.cashBalance) }, { timestamp: now, price: Number(user.cashBalance) }],
          period,
          kind: "portfolio-estimate",
        }, { headers: { "Cache-Control": "no-store" } });
      }
      const useSparkline = period === "24H" || period === "7D";
      const market = useSparkline ? await getMarketSnapshot() : null;
      const series = await Promise.all(positions.map(async (position) => {
        const asset = market?.assets.find((item) => item.symbol === position.symbol);
        if (useSparkline && !asset) throw new Error("Market sparkline unavailable");
        return {
          quantity: Number(position.quantity),
          points: useSparkline && asset ? sparklineHistory(asset, period as "24H" | "7D") : await getCoinHistory(position.symbol, period),
        };
      }));
      const timeline = series.reduce((shortest, item) => item.points.length < shortest.length ? item.points : shortest, series[0].points);
      const points = timeline.map(({ timestamp }) => ({
        timestamp,
        price: Number(user.cashBalance) + series.reduce((sum, item) => sum + item.quantity * nearestPrice(item.points, timestamp), 0),
      }));
      return NextResponse.json({ points, period, kind: "portfolio-estimate" }, { headers: { "Cache-Control": "no-store" } });
    }
    const symbol = (request.nextUrl.searchParams.get("symbol") ?? "BTC").toUpperCase();
    if (!supportedCoins.some((coin) => coin.symbol === symbol)) {
      return NextResponse.json({ error: "Unsupported asset" }, { status: 400 });
    }
    let points: ChartPoint[];
    if (period === "7D") {
      const market = await getMarketSnapshot();
      const asset = market.assets.find((item) => item.symbol === symbol);
      if (!asset) throw new Error("Market data unavailable");
      points = sparklineHistory(asset, "7D");
    } else if (period === "24H") {
      try { points = await getCoinHistory(symbol, period); }
      catch {
        const market = await getMarketSnapshot();
        const asset = market.assets.find((item) => item.symbol === symbol);
        if (!asset) throw new Error("Market data unavailable");
        points = sparklineHistory(asset, "24H");
      }
    } else {
      points = await getCoinHistory(symbol, period);
    }
    return NextResponse.json({ points, period, kind: "asset" }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } });
  } catch (error) {
    console.error("Market chart unavailable:", error);
    return NextResponse.json({ error: "Historical prices are temporarily unavailable. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
