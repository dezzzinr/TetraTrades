import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureCryptoCatalog } from "@/lib/crypto-catalog";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const count = await ensureCryptoCatalog(true);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Crypto catalog sync:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Catalog sync failed. Check the CoinGecko Demo key and rate limits." }, { status: 503 });
  }
}
