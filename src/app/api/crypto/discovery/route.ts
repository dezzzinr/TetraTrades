import { NextResponse } from "next/server";
import { getCryptoDiscovery } from "@/lib/crypto-catalog";
import { getMarketMode } from "@/lib/market-server";

export const dynamic = "force-dynamic";
export async function GET() {
  if (getMarketMode() === "demo") return NextResponse.json({ error: "Discovery requires provider mode." }, { status: 400 });
  try {
    return NextResponse.json(await getCryptoDiscovery(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Crypto discovery:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "CoinGecko discovery is temporarily unavailable." }, { status: 503 });
  }
}
