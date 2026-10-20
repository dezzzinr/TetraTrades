import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { copyTraders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { validateTraderFields } from "@/lib/copy-trading";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Update a trader's profile, stats, price, or active state.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = validateTraderFields(body, true);
    if (result.error !== undefined) return bad(result.error);
    if (Object.keys(result.updates).length === 0) return bad("Nothing to update.");
    const [row] = await db.update(copyTraders).set({ ...result.updates, updatedAt: new Date() }).where(eq(copyTraders.id, id)).returning();
    if (!row) return bad("Trader not found.", 404);
    return NextResponse.json({ success: true, trader: row });
  } catch (error) {
    console.error("Admin update copy trader:", error);
    return bad("Unable to update trader.", 500);
  }
}

// Remove a trader from the roster. Fails gracefully if subscription history
// references them - deactivate instead to hide them from new subscribers
// while preserving past subscription records.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { id } = await params;
    await db.delete(copyTraders).where(eq(copyTraders.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete copy trader:", error);
    const cause = error instanceof Error && "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
    const combinedMessage = [error, cause].filter((e): e is Error => e instanceof Error).map((e) => e.message).join(" | ");
    const code = (cause as { code?: string } | undefined)?.code ?? (error as { code?: string } | undefined)?.code;
    if (code === "23503" || /foreign key|violates/i.test(combinedMessage)) {
      return bad("This trader has subscription history and can't be deleted. Deactivate them instead.", 409);
    }
    return bad("Unable to delete trader.", 500);
  }
}
