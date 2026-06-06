import { NextRequest, NextResponse } from "next/server";
import { isSheetsConfigured } from "@/lib/google";
import { hasResponse } from "@/lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const language = p.get("language") ?? "";
  const test = p.get("test") ?? "";
  const email = p.get("email") ?? "";
  const name = p.get("name") ?? "";

  if (!isSheetsConfigured()) {
    return NextResponse.json({ configured: false, exists: false });
  }

  try {
    const exists = await hasResponse({ language, test, email, name });
    return NextResponse.json({ configured: true, exists });
  } catch (err) {
    return NextResponse.json(
      { configured: true, exists: false, error: String(err) },
      { status: 500 },
    );
  }
}
