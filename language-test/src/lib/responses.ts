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
        `Question: "${e.question}"`,
        `Answer: "${e.answer || "(blank)"}"`,
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

// Tên tab lưu kết quả theo catalog: {CATALOG}-Responses (vd PT2-Responses).
function responseSheetName(catalog: string): string {
  return `${(catalog || "TEST").trim()}-Responses`;
}

// Bảo đảm tab {CATALOG}-Responses tồn tại, tạo mới + header nếu chưa có.
async function ensureResponseSheet(catalog: string): Promise<string> {
  const sheets = getSheetsClient();
  const title = responseSheetName(catalog);
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  let sheet = meta.data.sheets?.find((s) => s.properties?.title === title);

  if (!sheet) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    sheet = created.data.replies?.[0]?.addSheet ?? undefined;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${title}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
  }

  // Tắt "tràn chữ" của Google Sheets ở cột Essay: đặt wrap = CLIP để nội dung
  // dài không lan sang ô khác (vẫn xem đủ khi click vào ô).
  const sheetId = sheet?.properties?.sheetId;
  const essayCol = HEADERS.indexOf("Essay");
  if (sheetId != null && essayCol >= 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startColumnIndex: essayCol,
                endColumnIndex: essayCol + 1,
              },
              cell: { userEnteredFormat: { wrapStrategy: "CLIP" } },
              fields: "userEnteredFormat.wrapStrategy",
            },
          },
        ],
      },
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
  test,
  email,
  name,
}: CheckParams): Promise<boolean> {
  const sheets = getSheetsClient();
  const title = responseSheetName(test);
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
  const title = await ensureResponseSheet(test);
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
