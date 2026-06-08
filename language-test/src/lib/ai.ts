import "server-only";
import type { EssayAnswer } from "./types";

// Hỗ trợ nhiều provider qua chuẩn OpenAI-compatible (chat completions).
// Cấu hình bằng env:
//   AI_PROVIDER = openai | gemini | deepseek   (mặc định openai)
//   AI_API_KEY  = khoá API của provider
//   AI_MODEL    = (tuỳ chọn) ghi đè model mặc định
//   AI_BASE_URL = (tuỳ chọn) ghi đè base URL
type ProviderId = "openai" | "gemini" | "deepseek";

interface ProviderCfg {
  baseUrl: string;
  defaultModel: string;
}

const PROVIDERS: Record<ProviderId, ProviderCfg> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  gemini: {
    // Endpoint tương thích OpenAI của Google Gemini
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
  },
};

function providerId(): ProviderId {
  const p = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
  return (p in PROVIDERS ? p : "openai") as ProviderId;
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

export interface EssayGradeResult {
  pass: boolean;
  score: number; // 0-10
  comment: string; // nhận xét đã gộp theo từng tiêu chí
}

const SYSTEM_PROMPT = `You are an examiner grading a candidate's free-text (essay) answer. Grade the answer in relation to the question and the passage/answer provided (and the model answer if given). Assess the answer against THESE CRITERIA:
- Vocabulary: range, accuracy and appropriateness of word choice.
- Grammar and Sentence Structure: grammatical accuracy, sentence construction, punctuation.
- Clarity/Conciseness: how clear, well-organized and concise the answer is, and whether it stays on topic.

Return ONLY ONE valid JSON object, with no text outside the JSON, in EXACTLY this shape:
{
  "pass": boolean,        // true if the answer meets the minimum requirements
  "score": number,        // overall score from 0 to 10
  "vocabulary": string,   // feedback on vocabulary
  "grammar": string,      // feedback on grammar and sentence structure
  "clarity": string,      // feedback on clarity/conciseness
  "overall": string       // overall comment and concrete suggestions for improvement
}
Write ALL feedback in English — concise, specific and constructive. If the answer is blank, gibberish or irrelevant to the question, set score=0, pass=false and state clearly that the candidate did not answer the question.`;

function buildUserPrompt(input: EssayAnswer): string {
  return [
    `Question: ${input.question}`,
    input.modelAnswer ? `Model answer: ${input.modelAnswer}` : "",
    input.suggestion ? `Hint: ${input.suggestion}` : "",
    `Candidate's answer: ${input.answer || "(blank)"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function extractJson(s: string): string {
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s;
}

function clampScore(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

function parseGrade(content: string): EssayGradeResult {
  try {
    const o = JSON.parse(extractJson(content)) as Record<string, unknown>;
    const line = (label: string, v: unknown) => {
      const t = String(v ?? "").trim();
      return t ? `• ${label}: ${t}` : "";
    };
    const overall = String(o.overall ?? "").trim();
    const comment = [
      line("Vocabulary", o.vocabulary),
      line("Grammar & Sentence Structure", o.grammar),
      line("Clarity & Conciseness", o.clarity),
      overall ? `→ ${overall}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return {
      pass: Boolean(o.pass),
      score: clampScore(o.score),
      comment: comment || String(o.comment ?? "").trim(),
    };
  } catch {
    return {
      pass: false,
      score: 0,
      comment:
        content.trim().slice(0, 500) || "Could not parse AI response.",
    };
  }
}

export async function gradeEssay(
  input: EssayAnswer,
): Promise<EssayGradeResult> {
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("AI_API_KEY is not configured");

  const pid = providerId();
  const cfg = PROVIDERS[pid];
  const baseUrl = (process.env.AI_BASE_URL ?? cfg.baseUrl).replace(/\/$/, "");
  const model = process.env.AI_MODEL || cfg.defaultModel;

  const body = JSON.stringify({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
    ],
  });

  // Retry on transient errors (429 rate limit, 5xx overloaded) with backoff.
  const maxAttempts = 3;
  let lastErr = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body,
    });

    if (res.ok) {
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return parseGrade(data.choices?.[0]?.message?.content ?? "");
    }

    const text = await res.text().catch(() => "");
    lastErr = `AI provider ${pid} HTTP error ${res.status}: ${text.slice(0, 200)}`;
    const transient = res.status === 429 || res.status >= 500;
    if (!transient || attempt === maxAttempts) break;
    await new Promise((r) => setTimeout(r, 800 * attempt));
  }
  throw new Error(lastErr);
}
