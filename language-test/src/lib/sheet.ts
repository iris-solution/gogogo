import "server-only";
import { getSheetsClient, SPREADSHEET_ID } from "./google";
import type {
  Answerable,
  Option,
  QuizItem,
  RawType,
  TestConfig,
} from "./types";

// Tab câu hỏi xác định theo gid; tab config theo tên.
const QUESTIONS_GID = Number(process.env.SHEET_GID ?? "474156801");
const CONFIG_SHEET = process.env.CONFIG_SHEET ?? "config";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

type Row = Record<string, string>;

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

// Cờ bật/tắt dạng văn bản trong sheet -> boolean (true/1/yes/x/có).
function parseBool(value: string | undefined): boolean {
  return ["true", "1", "yes", "x", "có", "co"].includes(
    clean(value).toLowerCase(),
  );
}

// Đổi lưới giá trị (hàng đầu là header) thành mảng object keyed theo header.
function toRows(values: unknown[][] | null | undefined): Row[] {
  const grid = values ?? [];
  if (grid.length === 0) return [];
  const header = (grid[0] ?? []).map((h) => String(h ?? "").trim());
  return grid.slice(1).map((cells) => {
    const obj: Row = {};
    header.forEach((key, i) => {
      if (key) obj[key] = cells?.[i] != null ? String(cells[i]) : "";
    });
    return obj;
  });
}

// Đọc toàn bộ giá trị của một tab (range = tên tab) qua service account.
async function getValues(range: string): Promise<Row[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return toRows(res.data.values as unknown[][] | undefined);
}

// Tìm tên tab câu hỏi theo gid (Sheets API dùng tên tab, không dùng gid trực tiếp).
async function questionsSheetTitle(): Promise<string> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const found = meta.data.sheets?.find(
    (s) => s.properties?.sheetId === QUESTIONS_GID,
  );
  const title = found?.properties?.title;
  if (!title) {
    throw new Error(
      `Không tìm thấy tab câu hỏi (gid=${QUESTIONS_GID}). Kiểm tra SHEET_GID và quyền chia sẻ cho service account.`,
    );
  }
  return title;
}

// Tách chuỗi letter đúng: hỗ trợ cả "," và "|"  (vd "A,B,C" hoặc "A|B")
function parseLetters(value: string | undefined): string[] {
  return clean(value)
    .split(/[,|]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function buildOptions(row: Row): Option[] {
  const options: Option[] = [];
  for (let i = 0; i < LETTERS.length; i++) {
    const text = clean(row[`Answer${i + 1}`]);
    if (text) options.push({ key: LETTERS[i], text });
  }
  return options;
}

function getMedia(row: Row): string | undefined {
  const raw = clean(row.Media) || clean(row.MediaUrl);
  // Chỉ coi là media khi là URL thật, tránh chữ rác (vd "-", "N/A") biến thành link.
  return /^https?:\/\//i.test(raw) ? raw : undefined;
}

function makeAnswerable(row: Row): Answerable {
  const type = clean(row.Type) as RawType;
  const base = {
    id: clean(row.Id),
    type,
    question: clean(row.Question),
    media: getMedia(row),
    description: clean(row.Descriptions) || undefined,
  };

  if (type === "FillBlank" || type === "Essay") {
    const accepted = clean(row.CorrectAnswer)
      .split(/[|/]/)
      .map((s) => s.trim())
      .filter(Boolean);
    // Giữ nguyên văn nội dung gợi ý đúng như trong sheet (không tách).
    const suggestion = clean(row.SuggestionAnswer);
    const long = type === "Essay";
    return { ...base, kind: "fill", accepted, suggestion, long };
  }

  const options = buildOptions(row);
  const correct = parseLetters(row.CorrectAnswer);
  const multi = type === "MultipleChoice" || correct.length > 1;
  return { ...base, kind: "choice", options, correct, multi };
}

// Đọc danh sách bài test từ tab `config`: Language | Catalog | Title | TimeLimit
export async function fetchConfig(): Promise<TestConfig[]> {
  const rows = await getValues(CONFIG_SHEET);
  return rows
    .map((r) => ({
      language: clean(r.Language),
      catalog: clean(r.Catalog),
      title: clean(r.Title),
      timeLimitMin: Number(clean(r.TimeLimit)) || 0,
      enableAI: parseBool(r.EnableAI),
    }))
    .filter((c) => c.language && c.catalog);
}

export async function fetchQuestions(catalog?: string): Promise<QuizItem[]> {
  const title = await questionsSheetTitle();
  const allRows = await getValues(title);

  const wantCatalog = catalog?.trim().toLowerCase();
  const rows = allRows.filter((r) => {
    if (!clean(r.Id)) return false;
    if (wantCatalog && clean(r.Catalog).toLowerCase() !== wantCatalog) {
      return false;
    }
    return true;
  });

  // Gom câu con theo ParentId
  const childrenByParent = new Map<string, Answerable[]>();
  for (const row of rows) {
    const parentId = clean(row.ParentId);
    if (!parentId) continue;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(makeAnswerable(row));
    childrenByParent.set(parentId, list);
  }

  // Câu cấp 1 (không có ParentId)
  const items: QuizItem[] = [];
  for (const row of rows) {
    if (clean(row.ParentId)) continue;
    const type = clean(row.Type) as RawType;
    const id = clean(row.Id);

    if (type === "Passage") {
      items.push({
        kind: "passage",
        id,
        type,
        question: clean(row.Question),
        media: getMedia(row),
        description: clean(row.Descriptions) || undefined,
        children: childrenByParent.get(id) ?? [],
      });
    } else {
      items.push(makeAnswerable(row));
    }
  }

  return items;
}
