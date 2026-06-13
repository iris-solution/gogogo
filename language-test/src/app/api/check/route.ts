import { NextRequest, NextResponse } from "next/server";
import { isSheetsConfigured } from "@/lib/google";
import { hasResponse } from "@/lib/responses";
import { verifyTestPassword } from "@/lib/sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const language = p.get("language") ?? "";
  const test = p.get("test") ?? "";
  const email = p.get("email") ?? "";
  const name = p.get("name") ?? "";
  const password = p.get("password") ?? "";

  if (!isSheetsConfigured()) {
    return NextResponse.json({ configured: false, exists: false, passwordOk: true });
  }

  try {
    // Xác thực mật khẩu trước: bài đặt mật khẩu mà nhập sai -> chặn ngay.
    const pw = await verifyTestPassword(language, test, password);
    if (pw.required && !pw.ok) {
      return NextResponse.json({ configured: true, exists: false, passwordOk: false });
    }

    const exists = await hasResponse({ language, test, email, name });
    return NextResponse.json({ configured: true, exists, passwordOk: true });
  } catch (err) {
    return NextResponse.json(
      { configured: true, exists: false, passwordOk: true, error: String(err) },
      { status: 500 },
    );
  }
}
