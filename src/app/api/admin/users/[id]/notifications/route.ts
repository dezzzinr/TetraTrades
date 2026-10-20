import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Send a notification to a single user, shown in their notification bell.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { id } = await params;
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    if (!user) return bad("User not found.", 404);

    const body = await request.json().catch(() => ({}));
    const title = String(body.title ?? "").trim().slice(0, 120);
    const message = String(body.message ?? "").trim().slice(0, 1000);
    if (title.length < 2) return bad("Enter a short title for this notification.");
    if (message.length < 2) return bad("Enter a message to send.");

    const row = await notifyUser({ userId: id, type: "admin_message", title, message, sentBy: admin.id });
    return NextResponse.json({ success: true, notification: row });
  } catch (error) {
    console.error("Admin send notification:", error);
    return bad("Unable to send notification.", 500);
  }
}
