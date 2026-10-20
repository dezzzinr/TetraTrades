import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { depositAccounts } from "@/db/schema";
import { asc, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { DEPOSIT_METHOD_IDS } from "@/lib/deposits";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Full list (active + inactive) for the admin management screen.
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const rows = await db.select().from(depositAccounts).orderBy(asc(depositAccounts.method), desc(depositAccounts.createdAt));
    return NextResponse.json({ accounts: rows });
  } catch (error) {
    console.error("Admin deposit accounts GET:", error);
    return bad("Unable to load deposit accounts.", 500);
  }
}

// Create a new destination account users can pay into for a given method.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const body = await request.json().catch(() => ({}));
    const method = String(body.method ?? "");
    if (!DEPOSIT_METHOD_IDS.includes(method as (typeof DEPOSIT_METHOD_IDS)[number])) return bad("Choose a valid deposit method.");
    const label = String(body.label ?? "").trim();
    if (label.length < 2 || label.length > 120) return bad("Label must be between 2 and 120 characters.");
    const instructions = String(body.instructions ?? "").trim();
    if (instructions.length < 2 || instructions.length > 2000) return bad("Provide account details between 2 and 2000 characters.");
    const [row] = await db.insert(depositAccounts).values({ method, label, instructions, isActive: body.isActive !== false }).returning();
    return NextResponse.json({ success: true, account: row });
  } catch (error) {
    console.error("Admin create deposit account:", error);
    return bad("Unable to create deposit account.", 500);
  }
}
