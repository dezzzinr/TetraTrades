import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { depositAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Update a destination account's label, instructions, or active state.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.label === "string") {
      const label = body.label.trim();
      if (label.length < 2 || label.length > 120) return bad("Label must be between 2 and 120 characters.");
      updates.label = label;
    }
    if (typeof body.instructions === "string") {
      const instructions = body.instructions.trim();
      if (instructions.length < 2 || instructions.length > 2000) return bad("Provide account details between 2 and 2000 characters.");
      updates.instructions = instructions;
    }
    if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
    const [row] = await db.update(depositAccounts).set(updates).where(eq(depositAccounts.id, id)).returning();
    if (!row) return bad("Deposit account not found.", 404);
    return NextResponse.json({ success: true, account: row });
  } catch (error) {
    console.error("Admin update deposit account:", error);
    return bad("Unable to update deposit account.", 500);
  }
}

// Remove a destination account. Past deposit requests keep a snapshot of
// the label they used, so history remains intact after deletion.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { id } = await params;
    await db.delete(depositAccounts).where(eq(depositAccounts.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete deposit account:", error);
    return bad("Unable to delete deposit account.", 500);
  }
}
