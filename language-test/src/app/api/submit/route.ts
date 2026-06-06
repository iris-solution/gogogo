import { NextRequest, NextResponse } from "next/server";
import { isSheetsConfigured } from "@/lib/google";
import { appendResult } from "@/lib/responses";
import type { TestResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  language: string;
  name: string;
  email: string;
  test: string;
  result: TestResult;
}

export async function POST(req: NextRequest) {
  if (!isSheetsConfigured()) {
    return NextResponse.json({ configured: false, ok: false });
  }
  try {
    const body = (await req.json()) as Body;
    await appendResult({
      language: body.language,
      name: body.name,
      email: body.email,
      test: body.test,
      result: body.result,
    });
    return NextResponse.json({ configured: true, ok: true });
  } catch (err) {
    return NextResponse.json(
      { configured: true, ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
