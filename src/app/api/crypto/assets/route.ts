import { NextRequest, NextResponse } from "next/server";
import { getCryptoAssetsPage } from "@/lib/crypto-catalog";
import { getMarketMode } from "@/lib/market-server";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  if (getMarketMode() === "demo") return NextResponse.json({ error: "The full CoinGecko universe is available in provider mode. Demo mode uses the synthetic starter catalog." }, { status: 400 });
  const params = request.nextUrl.searchParams;
  const page = Number(params.get("page") ?? 1);
  const perPage = Number(params.get("perPage") ?? 50);
  if (!Number.isFinite(page) || page < 1 || !Number.isFinite(perPage) || perPage < 1 || perPage > 100) return NextResponse.json({ error: "Invalid pagination" }, { status: 400 });
  try {
    const result = await getCryptoAssetsPage({ search: params.get("search") ?? "", page, perPage, category: params.get("category") ?? undefined, order: params.get("order") ?? undefined });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Crypto assets:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "CoinGecko catalog is temporarily unavailable. Check the Demo API key and rate limits." }, { status: 503 });
  }
}
