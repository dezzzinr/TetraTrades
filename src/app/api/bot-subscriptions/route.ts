import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { botProducts, botSubscriptions, users, transactions } from "@/db/schema";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { blockedActionMessage } from "@/lib/accounts";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// The current user's bot subscription history (active + expired), most
// recent first.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const rows = await db
      .select({
        id: botSubscriptions.id,
        botProductId: botSubscriptions.botProductId,
        botName: botProducts.name,
        amount: botSubscriptions.amount,
        startedAt: botSubscriptions.startedAt,
        expiresAt: botSubscriptions.expiresAt,
      })
      .from(botSubscriptions)
      .innerJoin(botProducts, eq(botSubscriptions.botProductId, botProducts.id))
      .where(eq(botSubscriptions.userId, user.id))
      .orderBy(desc(botSubscriptions.startedAt))
      .limit(100);
    return NextResponse.json({ subscriptions: rows });
  } catch (error) {
    console.error("Bot subscriptions GET:", error);
    return bad("Unable to load your bot subscriptions.", 500);
  }
}

// Subscribe to a bot product for a fixed 7-day window at its current price.
// Charges the user's paper-trading cash balance immediately; no renewal is
// automatic - the user re-subscribes once the window lapses. Once
// subscribed, the user can configure any number of instances of this bot
// from /api/bot-instances while the subscription stays active.
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const blocked = blockedActionMessage(user, "subscribe");
    if (blocked) return bad(blocked, 403);
    const body = await request.json().catch(() => ({}));
    const botProductId = String(body.botProductId ?? "");
    if (!botProductId) return bad("Choose a bot to subscribe to.");

    const [product] = await db.select().from(botProducts).where(and(eq(botProducts.id, botProductId), eq(botProducts.isActive, true))).limit(1);
    if (!product) return bad("This bot is no longer available.");

    const now = new Date();
    const [existing] = await db
      .select()
      .from(botSubscriptions)
      .where(and(eq(botSubscriptions.userId, user.id), eq(botSubscriptions.botProductId, botProductId), gt(botSubscriptions.expiresAt, now)))
      .limit(1);
    if (existing) return bad(`You're already subscribed to ${product.name} until ${existing.expiresAt.toLocaleDateString()}.`);

    const amount = Number(product.subscriptionAmount);
    const durationDays = product.subscriptionDurationDays ?? 7;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      if (amount > 0) {
        const [wallet] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
        if (Number(wallet.cashBalance) < amount) throw new Error("Insufficient available balance.");
        await tx.update(users).set({ cashBalance: sql`${users.cashBalance} - ${amount}` }).where(eq(users.id, user.id));
      }
      await tx.insert(botSubscriptions).values({ userId: user.id, botProductId, amount: amount.toFixed(2), startedAt: now, expiresAt });
      await tx.insert(transactions).values({ userId: user.id, type: "bot_subscription", amount: amount.toFixed(2), description: `Trading bot: ${product.name} (${durationDays} days)` });
    });

    await notifyUser({
      userId: user.id,
      type: "bot_subscribed",
      title: `Subscribed to ${product.name}`,
      message: `You subscribed to the ${product.name} trading bot for ${durationDays} days (ends ${expiresAt.toLocaleDateString()}).`,
    });

    return NextResponse.json({ success: true, expiresAt, message: `Subscribed to ${product.name} for ${durationDays} days.` });
  } catch (error) {
    console.error("Bot subscriptions POST:", error);
    return bad(error instanceof Error ? error.message : "Unable to subscribe. Please try again.", 400);
  }
}
