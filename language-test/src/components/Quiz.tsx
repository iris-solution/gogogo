"use client";

import { useMemo, useState } from "react";
import type {
  Answerable,
  ChoiceQuestion,
  FillQuestion,
  QuizItem,
} from "@/lib/types";
import YouTubeEmbed from "./YouTubeEmbed";

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}

// Lấy danh sách câu có thể trả lời (bỏ qua câu cha Passage)
function flatten(items: QuizItem[]): Answerable[] {
  const out: Answerable[] = [];
  for (const item of items) {
    if (item.kind === "passage") out.push(...item.children);
    else out.push(item);
  }
  return out;
}

// Render đoạn văn: thay [___](1) thành chỗ trống nhìn thấy được
function renderPassage(text: string) {
  const parts = text.split(/(\[_+\]\(\d+\))/g);
  return parts.map((part, i) => {
    const m = part.match(/\[_+\]\((\d+)\)/);
    if (m) {
      return (
        <span
          key={i}
          className="mx-1 inline-flex items-center rounded bg-amber-100 px-2 font-mono text-amber-800"
        >
          ___ ({m[1]})
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function Quiz({ items }: { items: QuizItem[] }) {
  const answerables = useMemo(() => flatten(items), [items]);

  // Đánh số thứ tự cho từng câu trả lời được
  const numberOf = useMemo(() => {
    const map = new Map<string, number>();
    answerables.forEach((q, i) => map.set(q.id, i + 1));
    return map;
  }, [answerables]);

  const [choice, setChoice] = useState<Record<string, string[]>>({});
  const [fill, setFill] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  function toggleChoice(q: ChoiceQuestion, key: string) {
    if (submitted) return;
    setChoice((prev) => {
      const current = prev[q.id] ?? [];
      if (q.multi) {
        const next = current.includes(key)
          ? current.filter((k) => k !== key)
          : [...current, key];
        return { ...prev, [q.id]: next };
      }
      return { ...prev, [q.id]: [key] };
    });
  }

  function isCorrect(q: Answerable): boolean {
    if (q.kind === "choice") {
      return sameSet(choice[q.id] ?? [], q.correct);
    }
    const typed = normalize(fill[q.id] ?? "");
    return q.accepted.some((a) => normalize(a) === typed) && typed.length > 0;
  }

  const answeredCount = answerables.filter((q) =>
    q.kind === "choice"
      ? (choice[q.id]?.length ?? 0) > 0
      : (fill[q.id]?.trim().length ?? 0) > 0,
  ).length;

  const score = answerables.filter(isCorrect).length;
  const total = answerables.length;

  function reset() {
    setChoice({});
    setFill({});
    setSubmitted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ----- Render một câu trả lời được -----
  function renderChoice(q: ChoiceQuestion) {
    const selected = choice[q.id] ?? [];
    return (
      <div className="space-y-2">
        {q.options.map((opt) => {
          const picked = selected.includes(opt.key);
          const correct = q.correct.includes(opt.key);
          let style = "border-zinc-200 hover:border-zinc-400 bg-white";
          if (submitted) {
            if (correct) style = "border-green-500 bg-green-50";
            else if (picked) style = "border-red-400 bg-red-50";
            else style = "border-zinc-200 bg-white";
          } else if (picked) {
            style = "border-blue-500 bg-blue-50";
          }
          return (
            <label
              key={opt.key}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 transition ${style}`}
            >
              <input
                type={q.multi ? "checkbox" : "radio"}
                name={q.id}
                checked={picked}
                onChange={() => toggleChoice(q, opt.key)}
                disabled={submitted}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="font-medium text-zinc-500">{opt.key}.</span>
              <span className="text-zinc-800">{opt.text}</span>
              {submitted && correct && (
                <span className="ml-auto text-green-600">✓</span>
              )}
              {submitted && picked && !correct && (
                <span className="ml-auto text-red-500">✗</span>
              )}
            </label>
          );
        })}
        {q.multi && !submitted && (
          <p className="text-xs text-zinc-400">Có thể chọn nhiều đáp án.</p>
        )}
      </div>
    );
  }

  function renderFill(q: FillQuestion) {
    const value = fill[q.id] ?? "";
    const correct = submitted && isCorrect(q);
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={value}
          disabled={submitted}
          onChange={(e) =>
            setFill((prev) => ({ ...prev, [q.id]: e.target.value }))
          }
          placeholder="Nhập đáp án..."
          className={`w-full max-w-sm rounded-lg border px-3 py-2 outline-none transition ${
            submitted
              ? correct
                ? "border-green-500 bg-green-50"
                : "border-red-400 bg-red-50"
              : "border-zinc-300 focus:border-blue-500"
          }`}
        />
        {q.suggestions.length > 0 && !submitted && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-zinc-400">Gợi ý:</span>
            {q.suggestions.map((s, i) => (
              <span
                key={i}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
              >
                {s}
              </span>
            ))}
          </div>
        )}
        {submitted && (
          <p className="text-sm">
            Đáp án đúng:{" "}
            <span className="font-semibold text-green-700">
              {q.accepted.join(" / ")}
            </span>
          </p>
        )}
      </div>
    );
  }

  function renderAnswerable(q: Answerable, child = false) {
    const num = numberOf.get(q.id);
    return (
      <div
        key={q.id}
        className={child ? "border-l-2 border-zinc-200 pl-4" : ""}
      >
        <div className="mb-2 flex gap-2">
          <span className="font-semibold text-blue-600">Câu {num}.</span>
          <span className="font-medium text-zinc-900">{q.question}</span>
        </div>
        {q.media && <YouTubeEmbed url={q.media} />}
        {q.kind === "choice" ? renderChoice(q) : renderFill(q)}
        {submitted && q.description && (
          <p className="mt-2 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            💡 {q.description}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {items.map((item) => (
        <section
          key={item.id}
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
        >
          {item.kind === "passage" ? (
            <div className="space-y-4">
              <div>
                <span className="mb-2 inline-block rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                  Đoạn văn
                </span>
                <p className="text-lg leading-relaxed text-zinc-900">
                  {renderPassage(item.question)}
                </p>
              </div>
              {item.media && <YouTubeEmbed url={item.media} />}
              <div className="space-y-5">
                {item.children.map((c) => renderAnswerable(c, true))}
              </div>
            </div>
          ) : (
            renderAnswerable(item)
          )}
        </section>
      ))}

      {/* Thanh hành động */}
      <div className="sticky bottom-4 z-10 rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-lg backdrop-blur">
        {!submitted ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-zinc-500">
              Đã trả lời {answeredCount}/{total} câu
            </span>
            <button
              onClick={() => {
                setSubmitted(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white transition hover:bg-blue-700"
            >
              Nộp bài
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <span className="text-base">
              Kết quả:{" "}
              <span className="font-bold text-blue-700">
                {score}/{total}
              </span>{" "}
              câu đúng ({Math.round((score / total) * 100)}%)
            </span>
            <button
              onClick={reset}
              className="rounded-xl border border-zinc-300 px-6 py-2.5 font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Làm lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
