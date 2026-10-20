import { NextRequest, NextResponse } from "next/server";
import { isLanguageCode } from "@/lib/i18n";
import { translateBatch } from "@/lib/translate-server";

export const dynamic = "force-dynamic";

// Translates a batch of English UI strings into the requested language.
// Stateless/keyless - no auth required (translated text isn't sensitive),
// but the request body is capped to keep this endpoint from being abused as
// an open translation proxy.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const language = String(body.language ?? "");
    const texts = Array.isArray(body.texts) ? body.texts.map((t: unknown) => String(t ?? "")) : [];
    if (!isLanguageCode(language)) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });
    if (texts.length === 0) return NextResponse.json({ translations: [] });
    if (texts.length > 400) return NextResponse.json({ error: "Too many strings in one request." }, { status: 400 });
    const translations = await translateBatch(texts, language);
    return NextResponse.json({ translations });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Translation failed." }, { status: 500 });
  }
}
