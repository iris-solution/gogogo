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
  comment: string;
}

const SYSTEM_PROMPT =
  "Bạn là giám khảo chấm câu trả lời tự luận. Đánh giá câu trả lời của thí sinh " +
  "dựa trên câu hỏi (và đáp án mẫu nếu có). CHỈ trả về một JSON hợp lệ dạng " +
  '{"pass": boolean, "comment": string}. "pass" = true nếu câu trả lời đạt yêu cầu. ' +
  '"comment" là nhận xét ngắn gọn bằng tiếng Việt (1-3 câu), nêu điểm tốt và điểm cần cải thiện.';

function buildUserPrompt(input: EssayAnswer): string {
  return [
    `Câu hỏi: ${input.question}`,
    input.modelAnswer ? `Đáp án mẫu: ${input.modelAnswer}` : "",
    input.suggestion ? `Gợi ý: ${input.suggestion}` : "",
    `Câu trả lời của thí sinh: ${input.answer || "(bỏ trống)"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function extractJson(s: string): string {
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s;
}

function parseGrade(content: string): EssayGradeResult {
  try {
    const obj = JSON.parse(extractJson(content)) as {
      pass?: unknown;
      comment?: unknown;
    };
    return {
      pass: Boolean(obj.pass),
      comment: String(obj.comment ?? "").trim(),
    };
  } catch {
    return {
      pass: false,
      comment:
        content.trim().slice(0, 500) || "Không phân tích được phản hồi AI.",
    };
  }
}

export async function gradeEssay(
  input: EssayAnswer,
): Promise<EssayGradeResult> {
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("Chưa cấu hình AI_API_KEY");

  const pid = providerId();
  const cfg = PROVIDERS[pid];
  const baseUrl = (process.env.AI_BASE_URL ?? cfg.baseUrl).replace(/\/$/, "");
  const model = process.env.AI_MODEL || cfg.defaultModel;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `AI provider ${pid} lỗi HTTP ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return parseGrade(content);
}
