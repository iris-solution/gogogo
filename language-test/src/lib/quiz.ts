import type {
  Answerable,
  ChoiceAnswers,
  FillAnswers,
  PerQuestionResult,
  QuizItem,
  TestResult,
} from "./types";

export function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}

// Danh sách câu trả lời được (bỏ qua câu cha Passage)
export function flatten(items: QuizItem[]): Answerable[] {
  const out: Answerable[] = [];
  for (const item of items) {
    if (item.kind === "passage") out.push(...item.children);
    else out.push(item);
  }
  return out;
}

export function isCorrect(
  q: Answerable,
  choice: ChoiceAnswers,
  fill: FillAnswers,
): boolean {
  if (q.kind === "choice") {
    // Câu chọn: không chọn -> luôn sai (kể cả khi sheet quên khai báo đáp án).
    if ((choice[q.id]?.length ?? 0) === 0) return false;
    return sameSet(choice[q.id] ?? [], q.correct);
  }
  // Câu fill: so nội dung nhập với đáp án. Đáp án có thể rỗng -> "để trống" mới đúng.
  const typed = normalize(fill[q.id] ?? "");
  const accepted = q.accepted.length > 0 ? q.accepted : [""];
  return accepted.some((a) => normalize(a) === typed);
}

export function isAnswered(
  q: Answerable,
  choice: ChoiceAnswers,
  fill: FillAnswers,
): boolean {
  return q.kind === "choice"
    ? (choice[q.id]?.length ?? 0) > 0
    : (fill[q.id]?.trim().length ?? 0) > 0;
}

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m} phút ${s} giây`;
}

export function computeResult(
  items: QuizItem[],
  choice: ChoiceAnswers,
  fill: FillAnswers,
  startAt: number,
  endAt: number,
): TestResult {
  const answerables = flatten(items);
  const perQuestion: PerQuestionResult[] = answerables.map((q) => ({
    id: q.id,
    question: q.question,
    correct: isCorrect(q, choice, fill),
  }));
  const score = perQuestion.filter((p) => p.correct).length;
  const total = answerables.length;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const durationSec = Math.max(0, Math.round((endAt - startAt) / 1000));
  return {
    score,
    total,
    percent,
    durationSec,
    durationText: formatDuration(durationSec),
    submittedAt: endAt,
    perQuestion,
  };
}
