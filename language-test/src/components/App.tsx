"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Candidate,
  ChoiceQuestion,
  QuizItem,
  Session,
  TestConfig,
} from "@/lib/types";
import { clearSession, loadSession, saveSession } from "@/lib/session";
import { computeResult, flatten, isAnswered } from "@/lib/quiz";
import StartForm from "./StartForm";
import QuizRunner from "./QuizRunner";
import Timer from "./Timer";
import Results, { type SaveState } from "./Results";

const LANG_LABEL: Record<string, string> = {
  ENG: "English",
  CN: "中文",
  VN: "Tiếng Việt",
};

// Chặn sao chép / cắt / dán / chuột phải / kéo-thả khi đang làm bài.
function blockClipboard(e: React.SyntheticEvent) {
  e.preventDefault();
}

export default function App({ configs }: { configs: TestConfig[] }) {
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<QuizItem[] | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saving");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Khôi phục session từ localStorage sau khi mount (tránh lệch SSR)
  useEffect(() => {
    setSession(loadSession());
    setMounted(true);
  }, []);

  // Khi đang làm bài / xem kết quả mà chưa có câu hỏi -> tải theo catalog
  useEffect(() => {
    if (!session || items || loadingItems) return;
    setLoadingItems(true);
    const qp = new URLSearchParams({ catalog: session.config.catalog });
    if (session.config.questionSheet)
      qp.set("sheet", session.config.questionSheet);
    fetch(`/api/questions?${qp.toString()}`)
      .then((r) => r.json())
      .then((j) => setItems(j.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoadingItems(false));
  }, [session, items, loadingItems]);

  const persist = useCallback((next: Session) => {
    saveSession(next);
    setSession(next);
  }, []);

  // ----- Bắt đầu làm bài -----
  const onStart = useCallback(
    async (candidate: Candidate, config: TestConfig) => {
      try {
        const q = new URLSearchParams({
          language: config.language,
          test: config.catalog,
          email: candidate.email,
          name: candidate.name,
        });
        const res = await fetch(`/api/check?${q.toString()}`);
        const j = await res.json();
        if (j.exists) {
          return {
            error: "Bạn đã làm bài test này rồi, không thể làm lại.",
          };
        }
      } catch {
        // Không chặn nếu việc kiểm tra lỗi mạng
      }
      const newSession: Session = {
        candidate,
        config,
        startAt: Date.now(),
        choice: {},
        fill: {},
        phase: "testing",
      };
      setItems(null);
      persist(newSession);
      return {};
    },
    [persist],
  );

  // ----- Trả lời -----
  const toggleChoice = useCallback(
    (q: ChoiceQuestion, key: string) => {
      if (!session) return;
      const current = session.choice[q.id] ?? [];
      let next: string[];
      if (q.multi) {
        next = current.includes(key)
          ? current.filter((k) => k !== key)
          : [...current, key];
      } else {
        next = [key];
      }
      persist({ ...session, choice: { ...session.choice, [q.id]: next } });
    },
    [session, persist],
  );

  const setFill = useCallback(
    (id: string, value: string) => {
      if (!session) return;
      persist({ ...session, fill: { ...session.fill, [id]: value } });
    },
    [session, persist],
  );

  // ----- Nộp bài -----
  const submit = useCallback(
    async (current: Session, list: QuizItem[]) => {
      const result = computeResult(
        list,
        current.choice,
        current.fill,
        current.startAt,
        Date.now(),
      );
      const done: Session = { ...current, phase: "result", result };
      persist(done);
      window.scrollTo({ top: 0, behavior: "smooth" });

      setSaveState("saving");
      try {
        const res = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: current.config.language,
            name: current.candidate.name,
            email: current.candidate.email,
            test: current.config.catalog,
            result,
          }),
        });
        const j = await res.json();
        setSaveState(j.configured === false ? "skipped" : j.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    },
    [persist],
  );

  const handleManualSubmit = useCallback(() => {
    if (!session || !items) return;
    setConfirmOpen(true);
  }, [session, items]);

  const confirmSubmit = useCallback(() => {
    setConfirmOpen(false);
    if (!session || !items) return;
    submit(session, items);
  }, [session, items, submit]);

  const handleExpire = useCallback(() => {
    if (session?.phase === "testing" && items) {
      submit(session, items);
    }
  }, [session, items, submit]);

  const onFinish = useCallback(() => {
    clearSession();
    setSession(null);
    setItems(null);
  }, []);

  // ----- Render -----
  if (!mounted) {
    return <CenterLoader text="Đang tải..." />;
  }

  // Chưa có phiên -> trang bắt đầu
  if (!session) {
    return (
      <div className="relative px-4 py-10">
        <MapBg />
        <StartForm configs={configs} onStart={onStart} />
      </div>
    );
  }

  if (!items) {
    return <CenterLoader text="Đang tải câu hỏi..." />;
  }

  // Xem kết quả
  if (session.phase === "result" && session.result) {
    return (
      <div className="px-4 py-8">
        <Results
          session={session}
          items={items}
          saveState={saveState}
          onFinish={onFinish}
        />
      </div>
    );
  }

  // Đang làm bài
  const answerables = flatten(items);
  const answered = answerables.filter((q) =>
    isAnswered(q, session.choice, session.fill),
  ).length;

  return (
    <div
      className="no-copy relative px-4 py-6"
      onCopy={blockClipboard}
      onCut={blockClipboard}
      onPaste={blockClipboard}
      onContextMenu={blockClipboard}
      onDragStart={blockClipboard}
    >
      <MapBg />
      <div className="mx-auto max-w-2xl">
        {/* Thanh trên cùng */}
        <div className="sticky top-0 z-20 -mx-4 mb-5 overflow-hidden rounded-b-2xl border-b border-orange-100 bg-white/85 px-4 pb-3 pt-3.5 shadow-sm shadow-orange-100/50 backdrop-blur">
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 via-orange-500 to-amber-400" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo/paihong.png"
                alt="PAIHO"
                className="h-7 w-auto shrink-0 rounded-md sm:h-8"
              />
              <span className="hidden h-8 w-px bg-zinc-200 sm:block" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold tracking-tight text-zinc-900">
                  {session.config.title || session.config.catalog}
                </p>
                <p className="truncate text-xs font-medium text-zinc-500">
                  {session.candidate.name} ·{" "}
                  {LANG_LABEL[session.config.language] ??
                    session.config.language}
                </p>
              </div>
            </div>
            <Timer
              startAt={session.startAt}
              timeLimitMin={session.config.timeLimitMin}
              onExpire={handleExpire}
            />
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-orange-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 transition-all"
                style={{
                  width: `${answerables.length ? (answered / answerables.length) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-500">
              {answered}/{answerables.length}
            </span>
          </div>
        </div>

        <QuizRunner
          items={items}
          choice={session.choice}
          fill={session.fill}
          mode="doing"
          onToggleChoice={toggleChoice}
          onFill={setFill}
        />

        <div className="sticky bottom-4 z-10 mt-6">
          <button
            onClick={handleManualSubmit}
            className="w-full rounded-xl bg-gradient-to-r from-red-600 to-orange-500 px-6 py-3.5 font-semibold text-white shadow-lg shadow-orange-200 transition hover:shadow-xl"
          >
            Nộp bài ({answered}/{answerables.length})
          </button>
        </div>
      </div>

      {confirmOpen && (
        <ConfirmModal
          answered={answered}
          total={answerables.length}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={confirmSubmit}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  answered,
  total,
  onCancel,
  onConfirm,
}: {
  answered: number;
  total: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const unanswered = total - answered;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm animate-[fadeInUp_0.2s_ease-out]"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm animate-[scaleIn_0.2s_ease-out] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-col items-center px-6 pt-7 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-2xl text-white shadow-lg shadow-orange-200">
            ?
          </div>
          <h3 className="mt-4 text-lg font-bold text-zinc-900">
            Nộp bài kiểm tra?
          </h3>
          <p className="mt-1.5 text-sm text-zinc-500">
            Bạn đã trả lời <span className="font-semibold text-zinc-700">{answered}/{total}</span> câu.
            {unanswered > 0 && (
              <>
                {" "}Còn{" "}
                <span className="font-semibold text-red-600">{unanswered}</span>{" "}
                câu chưa trả lời.
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Sau khi nộp, bạn không thể chỉnh sửa đáp án.
          </p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Tiếp tục làm
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-gradient-to-r from-red-600 to-orange-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-orange-200 transition hover:shadow-xl"
          >
            Nộp bài
          </button>
        </div>
      </div>
    </div>
  );
}

// Nền bản đồ Việt Nam dùng chung cho trang chính và trang làm bài
function MapBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-no-repeat opacity-[0.22]"
      style={{
        backgroundImage: "url('/images/Vietnam_map.png')",
        backgroundSize: "auto 68%",
        backgroundPosition: "65% center", 
        filter: "brightness(0)",
      }}
    />
  );
}

function CenterLoader({ text }: { text: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-zinc-400">
      <svg
        className="h-8 w-8 animate-spin text-red-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" />
        <path className="opacity-75" d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
      </svg>
      <p className="text-sm">{text}</p>
    </div>
  );
}
