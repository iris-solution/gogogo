import { NextRequest, NextResponse } from "next/server";
import { fetchQuestions } from "@/lib/sheet";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const catalog = req.nextUrl.searchParams.get("catalog") ?? "";
  try {
    const items = await fetchQuestions(catalog || undefined);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err), items: [] },
      { status: 500 },
    );
  }
}
