import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { copyTraders, copySubscriptions } from "@/db/schema";
import { eq, gt, desc } from "drizzle-orm";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Public (signed-in) roster of active copy traders, with a live "active
// subscribers" count and the viewer's own active subscription (if any)
// merged in so the UI can show "Subscribed · 3d left" vs. a subscribe button.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const traders = await db.select().from(copyTraders).where(eq(copyTraders.isActive, true)).orderBy(desc(copyTraders.returnPercent));
    const now = new Date();
    const activeSubs = await db.select().from(copySubscriptions).where(gt(copySubscriptions.expiresAt, now));

    const followerCounts = new Map<string, number>();
    for (const sub of activeSubs) followerCounts.set(sub.traderId, (followerCounts.get(sub.traderId) ?? 0) + 1);
    const mySubByTrader = new Map(activeSubs.filter((s) => s.userId === user.id).map((s) => [s.traderId, s]));

    const result = traders.map((t) => {
      const mine = mySubByTrader.get(t.id);
      return {
        id: t.id,
        name: t.name,
        handle: t.handle,
        avatarInitials: t.avatarInitials,
        avatarColor: t.avatarColor,
        focus: t.focus,
        bio: t.bio,
        riskLevel: t.riskLevel,
        returnPercent: t.returnPercent,
        winRate: t.winRate,
        subscriptionAmount: t.subscriptionAmount,
        subscriptionDurationDays: t.subscriptionDurationDays,
        rating: t.rating,
        country: t.country,
        photoUrl: t.photoUrl,
        activeSubscribers: followerCounts.get(t.id) ?? 0,
        mySubscription: mine ? { expiresAt: mine.expiresAt, amount: mine.amount } : null,
      };
    });

    return NextResponse.json({ traders: result });
  } catch (error) {
    console.error("Copy traders GET:", error);
    return NextResponse.json({ error: "Unable to load copy traders." }, { status: 500 });
  }
}
