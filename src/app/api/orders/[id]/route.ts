import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.action !== "cancel") return bad("Unknown action.");

    const updated = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, user.id))).for("update");
      if (!order) throw new Error("Order not found.");
      if (order.status !== "open") throw new Error("This order is no longer open.");
      await tx.update(orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(orders.id, id));
      return order;
    });

    await notifyUser({
      userId: user.id,
      type: "order_cancelled",
      title: "Order cancelled",
      message: `Your ${updated.side} order for ${updated.symbol} was cancelled.`,
    });

    return NextResponse.json({ success: true, message: `Cancelled ${updated.side} order for ${updated.symbol}.` });
  } catch (error) {
    console.error("Order cancel:", error);
    return bad(error instanceof Error ? error.message : "Unable to cancel this order.", 400);
  }
}
