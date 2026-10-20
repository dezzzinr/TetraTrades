import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { copyTraders, copySubscriptions } from "@/db/schema";
import { desc, gt } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { validateTraderFields } from "@/lib/copy-trading";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Full roster (active + inactive) with live active-subscriber counts for
// the admin management screen.
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const traders = await db.select().from(copyTraders).orderBy(desc(copyTraders.createdAt));
    const now = new Date();
    const activeSubs = await db.select({ traderId: copySubscriptions.traderId }).from(copySubscriptions).where(gt(copySubscriptions.expiresAt, now));
    const counts = new Map<string, number>();
    for (const sub of activeSubs) counts.set(sub.traderId, (counts.get(sub.traderId) ?? 0) + 1);
    return NextResponse.json({ traders: traders.map((t) => ({ ...t, activeSubscribers: counts.get(t.id) ?? 0 })) });
  } catch (error) {
    console.error("Admin copy-traders GET:", error);
    return bad("Unable to load copy traders.", 500);
  }
}

// Add a new trader profile to the roster.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const body = await request.json().catch(() => ({}));
    const result = validateTraderFields(body, false);
    if (result.error !== undefined) return bad(result.error);
    const [row] = await db.insert(copyTraders).values(result.updates as typeof copyTraders.$inferInsert).returning();
    return NextResponse.json({ success: true, trader: row });
  } catch (error) {
    console.error("Admin create copy trader:", error);
    return bad("Unable to create trader.", 500);
  }
}
