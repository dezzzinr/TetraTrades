import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Mark a single notification as read.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const { id } = await params;
    const [row] = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, user.id))).limit(1);
    if (!row) return bad("Notification not found.", 404);
    await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification PATCH:", error);
    return bad("Unable to update this notification.", 500);
  }
}
