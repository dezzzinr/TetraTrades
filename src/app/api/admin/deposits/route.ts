import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { depositRequests, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Lists deposit requests across all users for admin review, optionally
// filtered by status (pending | approved | rejected).
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const status = request.nextUrl.searchParams.get("status");

    const base = db
      .select({
        id: depositRequests.id,
        method: depositRequests.method,
        amount: depositRequests.amount,
        destinationLabel: depositRequests.destinationLabel,
        reference: depositRequests.reference,
        note: depositRequests.note,
        status: depositRequests.status,
        adminNote: depositRequests.adminNote,
        receiptFilename: depositRequests.receiptFilename,
        receiptMimeType: depositRequests.receiptMimeType,
        createdAt: depositRequests.createdAt,
        reviewedAt: depositRequests.reviewedAt,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
      })
      .from(depositRequests)
      .innerJoin(users, eq(depositRequests.userId, users.id));

    const filtered = status && ["pending", "approved", "rejected"].includes(status) ? base.where(eq(depositRequests.status, status)) : base;
    const rows = await filtered.orderBy(desc(depositRequests.createdAt)).limit(300);
    return NextResponse.json({ requests: rows });
  } catch (error) {
    console.error("Admin deposits GET:", error);
    return bad("Unable to load deposit requests.", 500);
  }
}
