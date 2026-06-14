import type {
  Answerable,
  ChoiceAnswers,
  EssayAnswer,
  FillAnswers,
  FillQuestion,
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

// Mô tả lựa chọn trắc nghiệm dạng "A. nội dung" (rơi về letter nếu thiếu text).
function describeChoice(q: Answerable, keys: string[]): string {
  if (q.kind !== "choice") return keys.join(", ");
  return keys
    .map((k) => {
      const opt = q.options.find((o) => o.key === k);
      return opt ? `${k}. ${opt.text}` : k;
    })
    .join(" | ");
}

// Câu trả lời của ứng viên dưới dạng text (để ghi vào sheet Details).
export function answerText(
  q: Answerable,
  choice: ChoiceAnswers,
  fill: FillAnswers,
): string {
  if (q.kind === "choice") {
    const keys = choice[q.id] ?? [];
    return keys.length > 0 ? describeChoice(q, keys) : "(không trả lời)";
  }
  const typed = (fill[q.id] ?? "").trim();
  return typed || "(không trả lời)";
}

// Đáp án đúng dưới dạng text (tham khảo).
export function correctText(q: Answerable): string {
  if (q.kind === "choice") return describeChoice(q, q.correct);
  return q.accepted.length > 0 ? q.accepted.join(" / ") : "";
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
  // Câu tự luận (Essay) tách riêng, không tính vào điểm tự động.
  const isEssay = (q: Answerable) => q.kind === "fill" && Boolean(q.long);
  const gradables = answerables.filter((q) => !isEssay(q));

  const perQuestion: PerQuestionResult[] = gradables.map((q) => ({
    id: q.id,
    question: q.question,
    correct: isCorrect(q, choice, fill),
    answer: answerText(q, choice, fill),
    correctAnswer: correctText(q) || undefined,
  }));
  const score = perQuestion.filter((p) => p.correct).length;
  const total = gradables.length;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const durationSec = Math.max(0, Math.round((endAt - startAt) / 1000));

  const essays: EssayAnswer[] = answerables.filter(isEssay).map((q) => {
    const fq = q as FillQuestion;
    return {
      id: fq.id,
      question: fq.question,
      answer: (fill[fq.id] ?? "").trim(),
      modelAnswer: fq.accepted.length > 0 ? fq.accepted.join(" / ") : undefined,
      suggestion: fq.suggestion || undefined,
    };
  });

  return {
    score,
    total,
    percent,
    durationSec,
    durationText: formatDuration(durationSec),
    submittedAt: endAt,
    perQuestion,
    essays,
  };
}
