import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { botSubscriptions, copySubscriptions, planSubscriptions, botProducts, copyTraders, plans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { notifyUser, type NotificationType } from "@/lib/notify";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

const TABLES = { bot: botSubscriptions, copy: copySubscriptions, plan: planSubscriptions } as const;
type Kind = keyof typeof TABLES;

// Admin override to end a user's subscription (bot/copy/plan) early, e.g.
// as part of a refund or dispute. Sets expiresAt to now rather than
// deleting the row, so subscription history is preserved.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { kind, id } = await params;
    if (!(kind in TABLES)) return bad("Invalid subscription type.");
    const body = await request.json().catch(() => ({}));
    if (body.action !== "cancel") return bad("Invalid action.");
    const table = TABLES[kind as Kind];
    const [row] = await db.update(table).set({ expiresAt: new Date() }).where(eq(table.id, id)).returning();
    if (!row) return bad("Subscription not found.", 404);

    let productName = "subscription";
    if (kind === "bot" && "botProductId" in row) {
      const [p] = await db.select({ name: botProducts.name }).from(botProducts).where(eq(botProducts.id, row.botProductId)).limit(1);
      productName = p?.name ?? "trading bot";
    } else if (kind === "copy" && "traderId" in row) {
      const [t] = await db.select({ name: copyTraders.name }).from(copyTraders).where(eq(copyTraders.id, row.traderId)).limit(1);
      productName = t?.name ?? "trader";
    } else if (kind === "plan" && "planId" in row) {
      const [pl] = await db.select({ name: plans.name }).from(plans).where(eq(plans.id, row.planId)).limit(1);
      productName = pl?.name ?? "plan";
    }
    const typeByKind: Record<Kind, NotificationType> = { bot: "bot_cancelled", copy: "copy_cancelled", plan: "plan_cancelled" };
    const labelByKind: Record<Kind, string> = { bot: "bot subscription", copy: "copy trading subscription", plan: "plan subscription" };
    await notifyUser({
      userId: row.userId,
      type: typeByKind[kind as Kind],
      title: `${kind === "bot" ? "Bot" : kind === "copy" ? "Copy trading" : "Plan"} subscription cancelled`,
      message: `Your ${labelByKind[kind as Kind]} to ${productName} was cancelled by an admin.`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin cancel subscription:", error);
    return bad("Unable to cancel this subscription.", 500);
  }
}
