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

export default function App({ configs }: { configs: TestConfig[] }) {
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<QuizItem[] | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saving");

  // Khôi phục session từ localStorage sau khi mount (tránh lệch SSR)
  useEffect(() => {
    setSession(loadSession());
    setMounted(true);
  }, []);

  // Khi đang làm bài / xem kết quả mà chưa có câu hỏi -> tải theo catalog
  useEffect(() => {
    if (!session || items || loadingItems) return;
    setLoadingItems(true);
    fetch(`/api/questions?catalog=${encodeURIComponent(session.config.catalog)}`)
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
    if (!window.confirm("Bạn chắc chắn muốn nộp bài?")) return;
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
      <div className="px-4 py-10">
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
    <div className="px-4 py-6">
      <div className="mx-auto max-w-2xl">
        {/* Thanh trên cùng */}
        <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-zinc-900">
                {session.config.title || session.config.catalog}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {session.candidate.name} ·{" "}
                {LANG_LABEL[session.config.language] ?? session.config.language}
              </p>
            </div>
            <Timer
              startAt={session.startAt}
              timeLimitMin={session.config.timeLimitMin}
              onExpire={handleExpire}
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{
                  width: `${answerables.length ? (answered / answerables.length) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="shrink-0 text-xs font-medium text-zinc-500">
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
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-blue-200 transition hover:shadow-xl"
          >
            Nộp bài ({answered}/{answerables.length})
          </button>
        </div>
      </div>
    </div>
  );
}

function CenterLoader({ text }: { text: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-zinc-400">
      <svg
        className="h-8 w-8 animate-spin text-blue-500"
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
