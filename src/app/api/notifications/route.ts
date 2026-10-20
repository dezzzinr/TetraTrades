import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// The current user's notifications (most recent first), plus an unread
// count. Supports pagination (limit/offset) and an optional type filter for
// the full Notifications page; the notification bell popover just calls
// this with the defaults.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const params = new URL(request.url).searchParams;
    const limit = Math.min(Math.max(Number(params.get("limit")) || 100, 1), 200);
    const offset = Math.max(Number(params.get("offset")) || 0, 0);
    const type = params.get("type");
    const where = type ? and(eq(notifications.userId, user.id), eq(notifications.type, type)) : eq(notifications.userId, user.id);

    const [rows, unread, total] = await Promise.all([
      db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
      db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(where),
    ]);
    return NextResponse.json({ notifications: rows, unread: unread[0]?.count ?? 0, total: total[0]?.count ?? 0 });
  } catch (error) {
    console.error("Notifications GET:", error);
    return bad("Unable to load your notifications.", 500);
  }
}

// Mark all of the current user's notifications as read.
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications POST:", error);
    return bad("Unable to update your notifications.", 500);
  }
}
