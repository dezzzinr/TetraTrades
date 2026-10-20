import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { botProducts, botSubscriptions } from "@/db/schema";
import { eq, gt, desc } from "drizzle-orm";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Public (signed-in) catalog of active bot products, with a live "active
// subscribers" count and the viewer's own active subscription (if any)
// merged in so the UI can show "Subscribed · 3d left" vs. a subscribe button.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const products = await db.select().from(botProducts).where(eq(botProducts.isActive, true)).orderBy(desc(botProducts.subscriptionAmount));
    const now = new Date();
    const activeSubs = await db.select().from(botSubscriptions).where(gt(botSubscriptions.expiresAt, now));

    const subscriberCounts = new Map<string, number>();
    for (const sub of activeSubs) subscriberCounts.set(sub.botProductId, (subscriberCounts.get(sub.botProductId) ?? 0) + 1);
    const mySubByProduct = new Map(activeSubs.filter((s) => s.userId === user.id).map((s) => [s.botProductId, s]));

    const result = products.map((p) => {
      const mine = mySubByProduct.get(p.id);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        strategy: p.strategy,
        riskLevel: p.riskLevel,
        minAllocation: p.minAllocation,
        subscriptionAmount: p.subscriptionAmount,
        subscriptionDurationDays: p.subscriptionDurationDays,
        rating: p.rating,
        country: p.country,
        photoUrl: p.photoUrl,
        activeSubscribers: subscriberCounts.get(p.id) ?? 0,
        mySubscription: mine ? { expiresAt: mine.expiresAt, amount: mine.amount } : null,
      };
    });

    return NextResponse.json({ bots: result });
  } catch (error) {
    console.error("Bots GET:", error);
    return NextResponse.json({ error: "Unable to load trading bots." }, { status: 500 });
  }
}
