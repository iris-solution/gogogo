"use client";

import type { QuizItem, Session } from "@/lib/types";
import QuizRunner from "./QuizRunner";

export type SaveState = "saving" | "saved" | "error" | "skipped";

interface Props {
  session: Session;
  items: QuizItem[];
  saveState: SaveState;
  onFinish: () => void;
}

const LANG_LABEL: Record<string, string> = {
  ENG: "English",
  CN: "中文",
  VN: "Tiếng Việt",
};

export default function Results({ session, items, saveState, onFinish }: Props) {
  const r = session.result!;
  const pass = r.percent >= 50;
  const circ = 2 * Math.PI * 52;
  const dash = (r.percent / 100) * circ;

  return (
    <div className="animate-[fadeInUp_0.5s_ease-out] mx-auto max-w-2xl">
      {/* Hero kết quả */}
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl">
        <div className="relative bg-gradient-to-br from-orange-500 via-red-500 to-red-600 px-8 py-8 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            {/* Vòng tròn phần trăm */}
            <div className="relative h-32 w-32 shrink-0 animate-[scaleIn_0.5s_ease-out]">
              <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="12"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="white"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ}`}
                  style={{ transition: "stroke-dasharray 1s ease-out" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold">{r.percent}%</span>
              </div>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm font-medium uppercase tracking-wide text-white/80">
                {pass ? "🎉 Hoàn thành tốt" : "Cần cố gắng thêm"}
              </p>
              <h1 className="mt-1 text-3xl font-bold">
                {r.score}/{r.total} câu đúng
              </h1>
              <p className="mt-1 text-white/90">
                {session.candidate.name} ·{" "}
                {LANG_LABEL[session.config.language] ?? session.config.language}{" "}
                · {session.config.title || session.config.catalog}
              </p>
            </div>
          </div>
        </div>

        {/* Chỉ số */}
        <div className="grid grid-cols-2 divide-x divide-zinc-100 border-b border-zinc-100 sm:grid-cols-4 sm:divide-x">
          <Stat label="Điểm" value={`${r.score}/${r.total}`} />
          <Stat label="Tỷ lệ" value={`${r.percent}%`} />
          <Stat label="Thời gian" value={r.durationText} />
          <Stat label="ID nhân viên" value={session.candidate.email} />
        </div>

        {/* Trạng thái lưu */}
        <div className="px-6 py-4">
          <SaveBadge state={saveState} />
        </div>
      </div>

      {/* Chi tiết từng câu */}
      <div className="mt-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-zinc-900">
          <span className="inline-block h-5 w-1 rounded-full bg-red-600" />
          Chi tiết bài làm
        </h2>
        <QuizRunner
          items={items}
          choice={session.choice}
          fill={session.fill}
          mode="review"
        />
      </div>

      <div className="sticky bottom-4 z-10 mt-6">
        <button
          onClick={onFinish}
          className="w-full rounded-xl border border-zinc-300 bg-white/90 px-6 py-3 font-semibold text-zinc-700 shadow-lg backdrop-blur transition hover:bg-zinc-50"
        >
          Hoàn tất & thoát
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <p
        className="mt-1 truncate text-lg font-bold text-zinc-900"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const map = {
    saving: {
      cls: "border-orange-200 bg-orange-50 text-orange-700",
      text: "Đang lưu kết quả về Google Sheets...",
    },
    saved: {
      cls: "border-green-200 bg-green-50 text-green-700",
      text: "✓ Đã lưu kết quả về Google Sheets",
    },
    error: {
      cls: "border-red-200 bg-red-50 text-red-700",
      text: "⚠ Không lưu được kết quả về Google Sheets (kiểm tra cấu hình).",
    },
    skipped: {
      cls: "border-amber-200 bg-amber-50 text-amber-700",
      text: "⚠ Chưa cấu hình Google Sheets API — kết quả chưa được lưu.",
    },
  }[state];
  return (
    <div
      className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${map.cls}`}
    >
      {map.text}
    </div>
  );
}
