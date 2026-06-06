"use client";

import { useMemo, useState } from "react";
import type { Candidate, TestConfig } from "@/lib/types";

const LANG_LABEL: Record<string, string> = {
  ENG: "English",
  CN: "中文 (Chinese)",
  VN: "Tiếng Việt",
  JP: "日本語 (Japanese)",
  KR: "한국어 (Korean)",
};

function langLabel(code: string): string {
  return LANG_LABEL[code] ?? code;
}

interface Props {
  configs: TestConfig[];
  onStart: (
    candidate: Candidate,
    config: TestConfig,
  ) => Promise<{ error?: string }>;
}

export default function StartForm({ configs, onStart }: Props) {
  const languages = useMemo(
    () => Array.from(new Set(configs.map((c) => c.language))),
    [configs],
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState(languages[0] ?? "");
  const [catalog, setCatalog] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tests = useMemo(
    () => configs.filter((c) => c.language === language),
    [configs, language],
  );

  const selected = tests.find((t) => t.catalog === catalog);
  const canStart = name.trim() && email.trim() && selected && !loading;

  async function handleStart() {
    if (!selected) {
      setError("Vui lòng chọn bài test.");
      return;
    }
    if (!name.trim() || !email.trim()) {
      setError("Vui lòng nhập họ tên và ID nhân viên.");
      return;
    }
    setError("");
    setLoading(true);
    const res = await onStart(
      { name: name.trim(), email: email.trim() },
      selected,
    );
    setLoading(false);
    if (res.error) setError(res.error);
  }

  return (
    <div className="animate-[fadeInUp_0.5s_ease-out] mx-auto max-w-lg">
      <div className="overflow-hidden rounded-3xl border border-orange-100/80 bg-white/95 shadow-2xl shadow-orange-200/50 backdrop-blur">
        {/* Header: logo bo góc, có nền màu phía sau */}
        <div className="relative flex flex-col items-center bg-gradient-to-br from-orange-100 via-amber-50 to-red-100 px-8 pt-7 pb-6 text-center">
          <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 via-orange-500 to-amber-400" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/paihong.png"
            alt="PAIHO"
            width={482}
            height={107}
            className="h-auto w-auto max-w-full rounded-xl"
          />
          <h1 className="mt-4 text-2xl font-bold text-zinc-900">
            Bài kiểm tra tổng hợp
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Nhập thông tin và chọn bài test để bắt đầu.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-5 border-t border-zinc-100 px-8 py-7">
          <Field label="Họ và tên" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="input"
            />
          </Field>

          <Field label="ID nhân viên" required>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="VD: NV001"
              className="input"
            />
          </Field>

          <Field label="Ngôn ngữ" required>
            <div className="flex flex-wrap gap-2">
              {languages.map((lng) => (
                <button
                  key={lng}
                  type="button"
                  onClick={() => {
                    setLanguage(lng);
                    setCatalog("");
                  }}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                    language === lng
                      ? "border-red-500 bg-red-50 text-red-700 ring-1 ring-red-200"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-red-300"
                  }`}
                >
                  {langLabel(lng)}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Bài test" required>
            <div className="grid gap-2">
              {tests.map((t) => (
                <button
                  key={t.catalog}
                  type="button"
                  onClick={() => setCatalog(t.catalog)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                    catalog === t.catalog
                      ? "border-red-500 bg-red-50 ring-1 ring-red-200"
                      : "border-zinc-200 bg-white hover:border-red-300"
                  }`}
                >
                  <span>
                    <span className="block font-semibold text-zinc-900">
                      {t.title || t.catalog}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {t.catalog}
                    </span>
                  </span>
                  <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                    ⏱ {t.timeLimitMin} phút
                  </span>
                </button>
              ))}
              {tests.length === 0 && (
                <p className="text-sm text-zinc-400">
                  Chưa có bài test cho ngôn ngữ này.
                </p>
              )}
            </div>
          </Field>

          {error && (
            <div className="animate-[fadeInUp_0.3s_ease-out] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={!canStart}
            className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-red-600 to-orange-500 px-6 py-3.5 font-semibold text-white shadow-lg shadow-orange-200 transition-all hover:shadow-xl hover:shadow-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> Đang kiểm tra...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Bắt đầu làm bài
                <span className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </span>
            )}
          </button>
          {selected && (
            <p className="text-center text-xs text-zinc-400">
              Khi bấm Bắt đầu, đồng hồ {selected.timeLimitMin} phút sẽ chạy và
              không thể tạm dừng.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" />
      <path className="opacity-75" d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}
