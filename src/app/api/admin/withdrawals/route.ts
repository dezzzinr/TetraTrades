import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { withdrawalRequests, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Lists withdrawal requests across all users for admin review, optionally
// filtered by status (pending | approved | rejected).
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const status = request.nextUrl.searchParams.get("status");

    const base = db
      .select({
        id: withdrawalRequests.id,
        method: withdrawalRequests.method,
        methodLabel: withdrawalRequests.methodLabel,
        amount: withdrawalRequests.amount,
        destination: withdrawalRequests.destination,
        note: withdrawalRequests.note,
        status: withdrawalRequests.status,
        adminNote: withdrawalRequests.adminNote,
        createdAt: withdrawalRequests.createdAt,
        reviewedAt: withdrawalRequests.reviewedAt,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
      })
      .from(withdrawalRequests)
      .innerJoin(users, eq(withdrawalRequests.userId, users.id));

    const filtered = status && ["pending", "approved", "rejected"].includes(status) ? base.where(eq(withdrawalRequests.status, status)) : base;
    const rows = await filtered.orderBy(desc(withdrawalRequests.createdAt)).limit(300);
    return NextResponse.json({ requests: rows });
  } catch (error) {
    console.error("Admin withdrawals GET:", error);
    return bad("Unable to load withdrawal requests.", 500);
  }
}
