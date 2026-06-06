"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  startAt: number; // epoch ms
  timeLimitMin: number; // phút
  onExpire: () => void;
}

function remainingSec(startAt: number, timeLimitMin: number): number {
  const endAt = startAt + timeLimitMin * 60 * 1000;
  return Math.max(0, Math.round((endAt - Date.now()) / 1000));
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Timer({ startAt, timeLimitMin, onExpire }: Props) {
  const [left, setLeft] = useState(() => remainingSec(startAt, timeLimitMin));
  const expired = useRef(false);

  useEffect(() => {
    function tick() {
      const r = remainingSec(startAt, timeLimitMin);
      setLeft(r);
      if (r <= 0 && !expired.current) {
        expired.current = true;
        onExpire();
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startAt, timeLimitMin, onExpire]);

  const total = timeLimitMin * 60;
  const ratio = total > 0 ? left / total : 0;
  const danger = left <= 60;
  const warn = left <= 300 && !danger;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-lg font-bold tabular-nums transition-colors ${
        danger
          ? "border-red-300 bg-red-50 text-red-600"
          : warn
            ? "border-amber-300 bg-amber-50 text-amber-700"
            : "border-zinc-200 bg-white text-zinc-800"
      } ${danger ? "animate-pulse" : ""}`}
      title="Thời gian còn lại"
    >
      <svg
        className="h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2 2M9 2h6" strokeLinecap="round" />
      </svg>
      {fmt(left)}
      <span className="ml-1 hidden h-1 w-16 overflow-hidden rounded-full bg-zinc-200 sm:block">
        <span
          className={`block h-full rounded-full transition-all duration-1000 ${
            danger ? "bg-red-500" : warn ? "bg-amber-500" : "bg-blue-500"
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
    </div>
  );
}
