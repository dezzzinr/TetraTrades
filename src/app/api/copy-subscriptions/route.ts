import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { copyTraders, copySubscriptions, users, transactions } from "@/db/schema";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { blockedActionMessage } from "@/lib/accounts";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// The current user's subscription history (active + expired), most recent first.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const rows = await db
      .select({
        id: copySubscriptions.id,
        traderId: copySubscriptions.traderId,
        traderName: copyTraders.name,
        traderHandle: copyTraders.handle,
        amount: copySubscriptions.amount,
        startedAt: copySubscriptions.startedAt,
        expiresAt: copySubscriptions.expiresAt,
      })
      .from(copySubscriptions)
      .innerJoin(copyTraders, eq(copySubscriptions.traderId, copyTraders.id))
      .where(eq(copySubscriptions.userId, user.id))
      .orderBy(desc(copySubscriptions.startedAt))
      .limit(100);
    return NextResponse.json({ subscriptions: rows });
  } catch (error) {
    console.error("Copy subscriptions GET:", error);
    return bad("Unable to load your subscriptions.", 500);
  }
}

// Subscribe to a trader for a fixed 7-day window at their current price.
// Charges the user's paper-trading cash balance immediately; no renewal is
// automatic - the user re-subscribes once the window lapses.
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const blocked = blockedActionMessage(user, "subscribe");
    if (blocked) return bad(blocked, 403);
    const body = await request.json().catch(() => ({}));
    const traderId = String(body.traderId ?? "");
    if (!traderId) return bad("Choose a trader to subscribe to.");

    const [trader] = await db.select().from(copyTraders).where(and(eq(copyTraders.id, traderId), eq(copyTraders.isActive, true))).limit(1);
    if (!trader) return bad("This trader is no longer available.");

    const now = new Date();
    const [existing] = await db
      .select()
      .from(copySubscriptions)
      .where(and(eq(copySubscriptions.userId, user.id), eq(copySubscriptions.traderId, traderId), gt(copySubscriptions.expiresAt, now)))
      .limit(1);
    if (existing) return bad(`You're already subscribed to ${trader.name} until ${existing.expiresAt.toLocaleDateString()}.`);

    const amount = Number(trader.subscriptionAmount);
    const durationDays = trader.subscriptionDurationDays ?? 7;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      if (amount > 0) {
        const [wallet] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
        if (Number(wallet.cashBalance) < amount) throw new Error("Insufficient available balance.");
        await tx.update(users).set({ cashBalance: sql`${users.cashBalance} - ${amount}` }).where(eq(users.id, user.id));
      }
      await tx.insert(copySubscriptions).values({ userId: user.id, traderId, amount: amount.toFixed(2), startedAt: now, expiresAt });
      await tx.insert(transactions).values({ userId: user.id, type: "subscription", amount: amount.toFixed(2), description: `Copy trading: ${trader.name} (${durationDays} days)` });
    });

    await notifyUser({
      userId: user.id,
      type: "copy_subscribed",
      title: `Subscribed to copy ${trader.name}`,
      message: `You subscribed to copy trade ${trader.name} for ${durationDays} days (ends ${expiresAt.toLocaleDateString()}).`,
    });

    return NextResponse.json({ success: true, expiresAt, message: `Subscribed to ${trader.name} for ${durationDays} days.` });
  } catch (error) {
    console.error("Copy subscriptions POST:", error);
    return bad(error instanceof Error ? error.message : "Unable to subscribe. Please try again.", 400);
  }
}
