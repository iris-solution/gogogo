import Papa from "papaparse";
import type {
  Answerable,
  Option,
  QuizItem,
  RawType,
  TestConfig,
} from "./types";

const SHEET_ID =
  process.env.SHEET_ID ?? "17-7hAjXUFwTGYtfvyp0dyjoq0M3UZA0E6MNJWqrU-Cg";
const SHEET_GID = process.env.SHEET_GID ?? "474156801";

const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
const CONFIG_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=config`;

const LETTERS = ["A", "B", "C", "D", "E", "F"];

type Row = Record<string, string>;

function clean(value: string | undefined): string {
  return (value ?? "").trim();
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

  if (type === "FillBlank") {
    const accepted = clean(row.CorrectAnswer)
      .split(/[|/]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const suggestions = clean(row.SuggestionAnswer)
      .split(/[/|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return { ...base, kind: "fill", accepted, suggestions };
  }

  const options = buildOptions(row);
  const correct = parseLetters(row.CorrectAnswer);
  const multi = type === "MultipleChoice" || correct.length > 1;
  return { ...base, kind: "choice", options, correct, multi };
}

// Đọc danh sách bài test từ tab `config`: Language | Catalog | Title | TimeLimit
export async function fetchConfig(): Promise<TestConfig[]> {
  const res = await fetch(CONFIG_CSV_URL, { next: { revalidate: 60 } });
  if (!res.ok) {
    throw new Error(`Không tải được tab config (HTTP ${res.status})`);
  }
  const csv = await res.text();
  const parsed = Papa.parse<Row>(csv, { header: true, skipEmptyLines: true });
  return parsed.data
    .map((r) => ({
      language: clean(r.Language),
      catalog: clean(r.Catalog),
      title: clean(r.Title),
      timeLimitMin: Number(clean(r.TimeLimit)) || 0,
    }))
    .filter((c) => c.language && c.catalog);
}

export async function fetchQuestions(catalog?: string): Promise<QuizItem[]> {
  const res = await fetch(CSV_URL, { next: { revalidate: 60 } });
  if (!res.ok) {
    throw new Error(`Không tải được Google Sheet (HTTP ${res.status})`);
  }
  const csv = await res.text();
  const parsed = Papa.parse<Row>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const wantCatalog = catalog?.trim().toLowerCase();
  const rows = parsed.data.filter((r) => {
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
