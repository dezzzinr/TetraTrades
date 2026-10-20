import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { plans, planSubscriptions } from "@/db/schema";
import { eq, gt, asc } from "drizzle-orm";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Public (signed-in) catalog of active plans, with a live "active
// subscribers" count and the viewer's own active subscription (if any)
// merged in so the UI can show "Current plan" vs. a subscribe button.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const rows = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sortOrder));
    const now = new Date();
    const activeSubs = await db.select().from(planSubscriptions).where(gt(planSubscriptions.expiresAt, now));

    const subscriberCounts = new Map<string, number>();
    for (const sub of activeSubs) subscriberCounts.set(sub.planId, (subscriberCounts.get(sub.planId) ?? 0) + 1);
    const mine = activeSubs.filter((s) => s.userId === user.id).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const mySubByPlan = new Map(mine.map((s) => [s.planId, s]));
    const currentPlanId = mine[0]?.planId ?? null;

    const result = rows.map((p) => {
      const sub = mySubByPlan.get(p.id);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        priceWeekly: p.priceWeekly,
        features: p.features,
        isFeatured: p.isFeatured,
        activeSubscribers: subscriberCounts.get(p.id) ?? 0,
        mySubscription: sub ? { expiresAt: sub.expiresAt, amount: sub.amount, isCurrent: p.id === currentPlanId } : null,
      };
    });

    return NextResponse.json({ plans: result });
  } catch (error) {
    console.error("Plans GET:", error);
    return NextResponse.json({ error: "Unable to load plans." }, { status: 500 });
  }
}
