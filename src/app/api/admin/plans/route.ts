import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { plans, planSubscriptions } from "@/db/schema";
import { asc, gt } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { validatePlanFields } from "@/lib/plans";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Full catalog (active + inactive) with live active-subscriber counts for
// the admin management screen.
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const rows = await db.select().from(plans).orderBy(asc(plans.sortOrder));
    const now = new Date();
    const activeSubs = await db.select({ planId: planSubscriptions.planId }).from(planSubscriptions).where(gt(planSubscriptions.expiresAt, now));
    const counts = new Map<string, number>();
    for (const sub of activeSubs) counts.set(sub.planId, (counts.get(sub.planId) ?? 0) + 1);
    return NextResponse.json({ plans: rows.map((p) => ({ ...p, activeSubscribers: counts.get(p.id) ?? 0 })) });
  } catch (error) {
    console.error("Admin plans GET:", error);
    return bad("Unable to load plans.", 500);
  }
}

// Add a new plan to the catalog.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const body = await request.json().catch(() => ({}));
    const result = validatePlanFields(body, false);
    if (result.error !== undefined) return bad(result.error);
    const [row] = await db.insert(plans).values(result.updates as typeof plans.$inferInsert).returning();
    return NextResponse.json({ success: true, plan: row });
  } catch (error) {
    console.error("Admin create plan:", error);
    return bad("Unable to create plan.", 500);
  }
}
