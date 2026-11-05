import { NextRequest, NextResponse } from "next/server";
import { getCryptoCoin } from "@/lib/crypto-catalog";
import { getMarketMode } from "@/lib/market-server";

export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (getMarketMode() === "demo") return NextResponse.json({ error: "Coin details require provider mode." }, { status: 400 });
  const { id } = await params;
  if (!/^[a-z0-9-]{1,120}$/i.test(id)) return NextResponse.json({ error: "Invalid coin id" }, { status: 400 });
  try {
    return NextResponse.json(await getCryptoCoin(id.toLowerCase()), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Crypto coin:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Coin details are temporarily unavailable." }, { status: 503 });
  }
}
