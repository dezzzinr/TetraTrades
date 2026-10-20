import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { depositRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { parseDataUrl } from "@/lib/deposits";

export const dynamic = "force-dynamic";

// Streams back the uploaded receipt file. Only the owner of the deposit
// request or an admin reviewing it may view it.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const { id } = await params;
    const [row] = await db.select().from(depositRequests).where(eq(depositRequests.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
    if (row.userId !== user.id && user.role !== "admin") return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const parsed = parseDataUrl(row.receiptData);
    if (!parsed) return NextResponse.json({ error: "Receipt data is unavailable." }, { status: 500 });
    const buffer = Buffer.from(parsed.base64, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": row.receiptMimeType,
        "Content-Disposition": `inline; filename="${row.receiptFilename.replace(/[^\w.\- ]/g, "_")}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Receipt GET:", error);
    return NextResponse.json({ error: "Unable to load receipt." }, { status: 500 });
  }
}
