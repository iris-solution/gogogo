"use client";

import { useMemo } from "react";
import type {
  Answerable,
  ChoiceAnswers,
  ChoiceQuestion,
  FillAnswers,
  FillQuestion,
  QuizItem,
} from "@/lib/types";
import { FcIdea } from "react-icons/fc";
import { flatten, isCorrect } from "@/lib/quiz";
import Media from "./Media";

interface Props {
  items: QuizItem[];
  choice: ChoiceAnswers;
  fill: FillAnswers;
  mode: "doing" | "review";
  onToggleChoice?: (q: ChoiceQuestion, key: string) => void;
  onFill?: (id: string, value: string) => void;
}

// Đoạn văn: [___](1) -> chỗ trống nhìn thấy được
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

export default function QuizRunner({
  items,
  choice,
  fill,
  mode,
  onToggleChoice,
  onFill,
}: Props) {
  const review = mode === "review";
  const numberOf = useMemo(() => {
    const map = new Map<string, number>();
    flatten(items).forEach((q, i) => map.set(q.id, i + 1));
    return map;
  }, [items]);

  function renderChoice(q: ChoiceQuestion) {
    const selected = choice[q.id] ?? [];
    return (
      <div className="space-y-2">
        {q.options.map((opt) => {
          const picked = selected.includes(opt.key);
          const correct = q.correct.includes(opt.key);
          let style =
            "border-zinc-200 bg-white/40 hover:border-orange-300 hover:bg-white/60";
          if (review) {
            if (correct) style = "border-green-500 bg-green-50/80";
            else if (picked) style = "border-red-400 bg-red-50/80";
            else style = "border-zinc-200 bg-white/40";
          } else if (picked) {
            style = "border-red-500 bg-red-50 ring-1 ring-red-200";
          }
          return (
            <label
              key={opt.key}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${style} ${
                review ? "cursor-default" : "active:scale-[0.99]"
              }`}
            >
              <input
                type={q.multi ? "checkbox" : "radio"}
                name={q.id}
                checked={picked}
                onChange={() => onToggleChoice?.(q, opt.key)}
                disabled={review}
                className="h-4 w-4 accent-red-600"
              />
              <span className="font-semibold text-zinc-400">{opt.key}.</span>
              <span className="text-zinc-800">{opt.text}</span>
              {review && correct && (
                <span className="ml-auto font-bold text-green-600">✓</span>
              )}
              {review && picked && !correct && (
                <span className="ml-auto font-bold text-red-500">✗</span>
              )}
            </label>
          );
        })}
        {q.multi && !review && (
          <p className="text-xs text-zinc-400">Có thể chọn nhiều đáp án.</p>
        )}
      </div>
    );
  }

  function renderFill(q: FillQuestion) {
    const value = fill[q.id] ?? "";
    const isEssay = Boolean(q.long);
    // Câu tự luận không tự chấm -> không tô xanh/đỏ khi xem lại.
    const correct = review && !isEssay && isCorrect(q, choice, fill);
    const stateClass = !review
      ? "border-zinc-300 bg-white/40 focus:border-orange-500 focus:bg-white/70 focus:ring-2 focus:ring-orange-100"
      : isEssay
        ? "border-zinc-300 bg-white/40"
        : correct
          ? "border-green-500 bg-green-50"
          : "border-red-400 bg-red-50";
    return (
      <div className="space-y-2">
        {q.long ? (
          <textarea
            value={value}
            disabled={review}
            onChange={(e) => onFill?.(q.id, e.target.value)}
            placeholder="Nhập câu trả lời..."
            rows={5}
            className={`w-full resize-y rounded-xl border px-3 py-2 outline-none transition ${stateClass}`}
          />
        ) : (
          <input
            type="text"
            value={value}
            disabled={review}
            onChange={(e) => onFill?.(q.id, e.target.value)}
            placeholder="Nhập đáp án..."
            className={`w-full max-w-sm rounded-xl border px-3 py-2 outline-none transition ${stateClass}`}
          />
        )}
        {q.suggestion && !review && (
          <p className="flex items-start gap-1.5 text-sm text-amber-700">
            <FcIdea className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="whitespace-pre-line">{q.suggestion}</span>
          </p>
        )}
        {review &&
          (isEssay ? (
            <p className="text-sm text-zinc-500">
              📝 Câu tự luận — câu trả lời được chấm riêng (AI hoặc giáo viên).
            </p>
          ) : (
            <p className="text-sm">
              Đáp án đúng:{" "}
              <span className="font-semibold text-green-700">
                {q.accepted.length > 0 ? q.accepted.join(" / ") : "(để trống)"}
              </span>
            </p>
          ))}
      </div>
    );
  }

  function renderAnswerable(q: Answerable, child = false) {
    const num = numberOf.get(q.id);
    return (
      <div key={q.id} className={child ? "border-l-2 border-zinc-200 pl-4" : ""}>
        <div className="mb-2 flex gap-2">
          <span className="shrink-0 font-bold text-red-600">Câu {num}.</span>
          <span className="font-medium text-zinc-900">{q.question}</span>
        </div>
        {q.media && <Media url={q.media} />}
        {q.kind === "choice" ? renderChoice(q) : renderFill(q)}
        {review && q.description && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span className="whitespace-pre-line">{q.description}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {items.map((item) => (
        <section
          key={item.id}
          className="rounded-2xl border border-white/60 bg-white/35 p-5 shadow-sm backdrop-blur-sm transition hover:shadow-md"
        >
          {item.kind === "passage" ? (
            <div className="space-y-4">
              <div>
                <span className="mb-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  Đoạn văn
                </span>
                <p className="text-lg leading-relaxed text-zinc-900">
                  {renderPassage(item.question)}
                </p>
              </div>
              {item.media && <Media url={item.media} />}
              <div className="space-y-5">
                {item.children.map((c) => renderAnswerable(c, true))}
              </div>
            </div>
          ) : (
            renderAnswerable(item)
          )}
        </section>
      ))}
    </div>
  );
}
