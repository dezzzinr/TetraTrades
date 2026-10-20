import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { plans, planSubscriptions, users, transactions } from "@/db/schema";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { blockedActionMessage } from "@/lib/accounts";
import { SUBSCRIPTION_MS } from "@/lib/plans";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// The current user's plan subscription history (active + expired), most
// recent first.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const rows = await db
      .select({
        id: planSubscriptions.id,
        planId: planSubscriptions.planId,
        planName: plans.name,
        amount: planSubscriptions.amount,
        startedAt: planSubscriptions.startedAt,
        expiresAt: planSubscriptions.expiresAt,
      })
      .from(planSubscriptions)
      .innerJoin(plans, eq(planSubscriptions.planId, plans.id))
      .where(eq(planSubscriptions.userId, user.id))
      .orderBy(desc(planSubscriptions.startedAt))
      .limit(100);
    return NextResponse.json({ subscriptions: rows });
  } catch (error) {
    console.error("Plan subscriptions GET:", error);
    return bad("Unable to load your plan subscriptions.", 500);
  }
}

// Subscribe to a plan for a fixed 7-day (weekly) window at its current
// price. Charges the user's paper-trading cash balance immediately; no
// renewal is automatic - the user re-subscribes (or switches plans) once a
// cycle lapses. Switching to a different plan is always allowed; resubscribing
// to the same plan while it's still active is blocked.
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const blocked = blockedActionMessage(user, "subscribe");
    if (blocked) return bad(blocked, 403);
    const body = await request.json().catch(() => ({}));
    const planId = String(body.planId ?? "");
    if (!planId) return bad("Choose a plan to subscribe to.");

    const [plan] = await db.select().from(plans).where(and(eq(plans.id, planId), eq(plans.isActive, true))).limit(1);
    if (!plan) return bad("This plan is no longer available.");

    const now = new Date();
    const [existing] = await db
      .select()
      .from(planSubscriptions)
      .where(and(eq(planSubscriptions.userId, user.id), eq(planSubscriptions.planId, planId), gt(planSubscriptions.expiresAt, now)))
      .limit(1);
    if (existing) return bad(`You're already on the ${plan.name} plan until ${existing.expiresAt.toLocaleDateString()}.`);

    const amount = Number(plan.priceWeekly);
    const expiresAt = new Date(now.getTime() + SUBSCRIPTION_MS);

    await db.transaction(async (tx) => {
      if (amount > 0) {
        const [wallet] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
        if (Number(wallet.cashBalance) < amount) throw new Error("Insufficient available balance.");
        await tx.update(users).set({ cashBalance: sql`${users.cashBalance} - ${amount}` }).where(eq(users.id, user.id));
      }
      await tx.insert(planSubscriptions).values({ userId: user.id, planId, amount: amount.toFixed(2), startedAt: now, expiresAt });
      await tx.insert(transactions).values({ userId: user.id, type: "plan", amount: amount.toFixed(2), description: `${plan.name} plan subscription (7 days)` });
    });

    await notifyUser({
      userId: user.id,
      type: "plan_subscribed",
      title: `Subscribed to the ${plan.name} plan`,
      message: `You're now on the ${plan.name} plan for 7 days (ends ${expiresAt.toLocaleDateString()}).`,
    });

    return NextResponse.json({ success: true, expiresAt, message: `You're now on the ${plan.name} plan for 7 days.` });
  } catch (error) {
    console.error("Plan subscriptions POST:", error);
    return bad(error instanceof Error ? error.message : "Unable to subscribe. Please try again.", 400);
  }
}
