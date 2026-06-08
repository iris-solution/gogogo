import { NextRequest, NextResponse } from "next/server";
import { isSheetsConfigured } from "@/lib/google";
import { appendResult } from "@/lib/responses";
import { fetchConfig } from "@/lib/sheet";
import { gradeEssay, isAIConfigured } from "@/lib/ai";
import type { EssayGrade, TestResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  language: string;
  name: string;
  email: string;
  test: string;
  result: TestResult;
}

// Cờ EnableAI lấy từ tab config theo đúng bài test (language + catalog).
async function isAIEnabled(language: string, test: string): Promise<boolean> {
  try {
    const configs = await fetchConfig();
    return (
      configs.find((c) => c.catalog === test && c.language === language)
        ?.enableAI ?? false
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isSheetsConfigured()) {
    return NextResponse.json({ configured: false, ok: false });
  }
  try {
    const body = (await req.json()) as Body;
    const answers = body.result.essays ?? [];

    // Chấm AI nếu bài test bật EnableAI và đã cấu hình provider; lỗi -> để chấm tay.
    let essays: EssayGrade[] = answers.map((e) => ({ ...e, graded: false }));
    if (answers.length > 0 && isAIConfigured()) {
      const enabled = await isAIEnabled(body.language, body.test);
      if (enabled) {
        essays = await Promise.all(
          answers.map(async (e) => {
            try {
              const g = await gradeEssay(e);
              return { ...e, graded: true, pass: g.pass, comment: g.comment };
            } catch (err) {
              return { ...e, graded: false, comment: `AI lỗi: ${String(err)}` };
            }
          }),
        );
      }
    }

    await appendResult({
      language: body.language,
      name: body.name,
      email: body.email,
      test: body.test,
      result: body.result,
      essays,
    });
    return NextResponse.json({ configured: true, ok: true });
  } catch (err) {
    return NextResponse.json(
      { configured: true, ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
