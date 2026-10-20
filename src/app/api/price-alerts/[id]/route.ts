import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { priceAlerts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Cancel an open price alert before it triggers.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.action !== "cancel") return bad("Unknown action.");

    const [alert] = await db.select().from(priceAlerts).where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, user.id))).limit(1);
    if (!alert) return bad("Price alert not found.", 404);
    if (alert.status !== "open") return bad("This alert is no longer active.");
    await db.update(priceAlerts).set({ status: "cancelled" }).where(eq(priceAlerts.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Price alert cancel:", error);
    return bad("Unable to cancel this price alert.", 500);
  }
}
