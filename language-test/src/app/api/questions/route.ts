import { NextRequest, NextResponse } from "next/server";
import { fetchQuestions } from "@/lib/sheet";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const catalog = p.get("catalog") ?? "";
  const sheet = p.get("sheet") ?? "";
  try {
    const items = await fetchQuestions(catalog || undefined, sheet || undefined);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err), items: [] },
      { status: 500 },
    );
  }
}
