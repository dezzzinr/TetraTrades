import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { botProducts, botSubscriptions } from "@/db/schema";
import { desc, gt } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { validateBotProductFields } from "@/lib/bots";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Full catalog (active + inactive) with live active-subscriber counts for
// the admin management screen.
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const products = await db.select().from(botProducts).orderBy(desc(botProducts.createdAt));
    const now = new Date();
    const activeSubs = await db.select({ botProductId: botSubscriptions.botProductId }).from(botSubscriptions).where(gt(botSubscriptions.expiresAt, now));
    const counts = new Map<string, number>();
    for (const sub of activeSubs) counts.set(sub.botProductId, (counts.get(sub.botProductId) ?? 0) + 1);
    return NextResponse.json({ bots: products.map((p) => ({ ...p, activeSubscribers: counts.get(p.id) ?? 0 })) });
  } catch (error) {
    console.error("Admin bots GET:", error);
    return bad("Unable to load trading bots.", 500);
  }
}

// Add a new bot product to the catalog.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const body = await request.json().catch(() => ({}));
    const result = validateBotProductFields(body, false);
    if (result.error !== undefined) return bad(result.error);
    const [row] = await db.insert(botProducts).values(result.updates as typeof botProducts.$inferInsert).returning();
    return NextResponse.json({ success: true, bot: row });
  } catch (error) {
    console.error("Admin create bot:", error);
    return bad("Unable to create bot.", 500);
  }
}
