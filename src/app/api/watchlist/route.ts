import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { watchlistItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { getAsset } from "@/lib/market";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// The current user's starred symbols, e.g. ["BTC", "ETH"].
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const rows = await db.select({ symbol: watchlistItems.symbol }).from(watchlistItems).where(eq(watchlistItems.userId, user.id));
    return NextResponse.json({ symbols: rows.map((r) => r.symbol) });
  } catch (error) {
    console.error("Watchlist GET:", error);
    return bad("Unable to load your watchlist.", 500);
  }
}

// Star an asset.
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const body = await request.json().catch(() => ({}));
    const symbol = String(body.symbol ?? "").toUpperCase();
    if (!getAsset(symbol)) return bad("Choose a valid asset.");
    await db.insert(watchlistItems).values({ userId: user.id, symbol }).onConflictDoNothing();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Watchlist POST:", error);
    return bad("Unable to update your watchlist.", 500);
  }
}

// Unstar an asset.
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const symbol = String(new URL(request.url).searchParams.get("symbol") ?? "").toUpperCase();
    if (!symbol) return bad("Missing symbol.");
    await db.delete(watchlistItems).where(and(eq(watchlistItems.userId, user.id), eq(watchlistItems.symbol, symbol)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Watchlist DELETE:", error);
    return bad("Unable to update your watchlist.", 500);
  }
}
