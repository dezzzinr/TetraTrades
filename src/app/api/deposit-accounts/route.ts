import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { depositAccounts } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Lists the admin-configured destination accounts users should pay into.
// Only active accounts are exposed here; inactive ones are admin-only.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Please sign in to view deposit destinations." }, { status: 401 });
    const rows = await db
      .select({ id: depositAccounts.id, method: depositAccounts.method, label: depositAccounts.label, instructions: depositAccounts.instructions })
      .from(depositAccounts)
      .where(eq(depositAccounts.isActive, true))
      .orderBy(asc(depositAccounts.method), asc(depositAccounts.label));
    return NextResponse.json({ accounts: rows });
  } catch (error) {
    console.error("Deposit accounts GET:", error);
    return NextResponse.json({ error: "Unable to load deposit destinations." }, { status: 500 });
  }
}
