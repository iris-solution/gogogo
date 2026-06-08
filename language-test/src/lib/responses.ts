import "server-only";
import { getSheetsClient, SPREADSHEET_ID } from "./google";
import type { EssayGrade, TestResult } from "./types";

// Cột tab {LANG}-Responses:
// Timestamp | Name | Test | Score | Percent | Duration | Email | Language | Details | Essay
const HEADERS = [
  "Timestamp",
  "Name",
  "Test",
  "Score",
  "Percent",
  "Duration",
  "Email",
  "Language",
  "Details",
  "Essay",
];

// Merge essay questions (answer + AI feedback) into one readable cell. English only.
function formatEssays(essays: EssayGrade[]): string {
  return essays
    .map((e) => {
      const lines = [
        `Question: ${e.question}`,
        `Answer: ${e.answer || "(blank)"}`,
      ];
      if (e.graded) {
        const score = typeof e.score === "number" ? ` ${e.score}/10` : "";
        lines.push(
          `AI (${e.pass ? "Pass" : "Fail"}${score}): ${e.comment ?? ""}`,
        );
      } else if (e.comment) {
        lines.push(`Note: ${e.comment}`);
      }
      return lines.join("\n");
    })
    .join("\n\n———\n\n");
}

function responseSheetName(language: string): string {
  return `${(language || "ENG").trim()}-Responses`;
}

// Bảo đảm tab {LANG}-Responses tồn tại, tạo mới + header nếu chưa có.
async function ensureResponseSheet(language: string): Promise<string> {
  const sheets = getSheetsClient();
  const title = responseSheetName(language);
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets?.some(
    (s) => s.properties?.title === title,
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${title}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
  }
  return title;
}

export interface CheckParams {
  language: string;
  test: string;
  email: string;
  name: string;
}

// Đã làm bài = cùng test và (cùng email, hoặc cùng name nếu không nhập email)
export async function hasResponse({
  language,
  test,
  email,
  name,
}: CheckParams): Promise<boolean> {
  const sheets = getSheetsClient();
  const title = responseSheetName(language);
  let rows: string[][] = [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${title}!A:I`,
    });
    rows = (res.data.values as string[][]) ?? [];
  } catch {
    // Tab chưa tồn tại -> chưa ai làm bài
    return false;
  }

  const wantTest = test.trim().toLowerCase();
  const wantEmail = email.trim().toLowerCase();
  const wantName = name.trim().toLowerCase();

  return rows.some((r) => {
    const rTest = String(r[2] ?? "").trim().toLowerCase(); // Test
    const rEmail = String(r[6] ?? "").trim().toLowerCase(); // Email
    const rName = String(r[1] ?? "").trim().toLowerCase(); // Name
    if (rTest !== wantTest) return false;
    if (wantEmail) return rEmail === wantEmail;
    return Boolean(wantName) && rName === wantName;
  });
}

export interface SubmitParams {
  language: string;
  name: string;
  email: string;
  test: string; // catalog
  result: TestResult;
  essays?: EssayGrade[]; // câu tự luận đã (hoặc chưa) chấm AI
}

export async function appendResult({
  language,
  name,
  email,
  test,
  result,
  essays = [],
}: SubmitParams): Promise<void> {
  const sheets = getSheetsClient();
  const title = await ensureResponseSheet(language);
  const row = [
    new Date().toLocaleString("vi-VN"),
    name,
    test,
    `${result.score}/${result.total}`,
    `${result.percent}%`,
    result.durationText,
    email,
    language,
    JSON.stringify(result.perQuestion),
    essays.length > 0 ? formatEssays(essays) : "",
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${title}!A:J`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}
