import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { botProducts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { validateBotProductFields } from "@/lib/bots";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Update a bot's profile, stats, price, or active state.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = validateBotProductFields(body, true);
    if (result.error !== undefined) return bad(result.error);
    if (Object.keys(result.updates).length === 0) return bad("Nothing to update.");
    const [row] = await db.update(botProducts).set({ ...result.updates, updatedAt: new Date() }).where(eq(botProducts.id, id)).returning();
    if (!row) return bad("Bot not found.", 404);
    return NextResponse.json({ success: true, bot: row });
  } catch (error) {
    console.error("Admin update bot:", error);
    return bad("Unable to update bot.", 500);
  }
}

// Remove a bot from the catalog. Fails gracefully if subscription history
// references it - deactivate instead to hide it from new subscribers while
// preserving past subscription records and existing user instances.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { id } = await params;
    await db.delete(botProducts).where(eq(botProducts.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete bot:", error);
    const cause = error instanceof Error && "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
    const combinedMessage = [error, cause].filter((e): e is Error => e instanceof Error).map((e) => e.message).join(" | ");
    const code = (cause as { code?: string } | undefined)?.code ?? (error as { code?: string } | undefined)?.code;
    if (code === "23503" || /foreign key|violates/i.test(combinedMessage)) {
      return bad("This bot has subscription history and can't be deleted. Deactivate it instead.", 409);
    }
    return bad("Unable to delete bot.", 500);
  }
}
