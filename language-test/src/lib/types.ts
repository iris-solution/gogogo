// Loại câu hỏi gốc trong Google Sheets
export type RawType =
  | "TrueFalse"
  | "MultipleChoice"
  | "Normal"
  | "Passage"
  | "FillBlank"
  | "Essay";

export interface Option {
  key: string; // "A".."F"
  text: string;
}

interface Base {
  id: string;
  type: RawType;
  question: string;
  media?: string; // link YouTube (nếu có)
  description?: string; // giải thích
}

// Câu hỏi trắc nghiệm (TrueFalse / MultipleChoice / Normal)
export interface ChoiceQuestion extends Base {
  kind: "choice";
  options: Option[];
  correct: string[]; // các letter đúng
  multi: boolean; // cho phép chọn nhiều
}

// Câu điền vào chỗ trống / tự luận (Essay)
export interface FillQuestion extends Base {
  kind: "fill";
  accepted: string[]; // các đáp án được chấp nhận
  suggestion: string; // gợi ý hiển thị (nguyên văn từ sheet)
  long?: boolean; // true = câu tự luận -> ô nhập nhiều dòng
}

export type Answerable = ChoiceQuestion | FillQuestion;

// Đoạn văn (câu cha) chứa các câu con
export interface PassageQuestion extends Base {
  kind: "passage";
  children: Answerable[];
}

export type QuizItem = Answerable | PassageQuestion;

// Một bài test lấy từ tab `config`: Language | Catalog | Title | TimeLimit | EnableAI
export interface TestConfig {
  language: string; // mã ngôn ngữ, vd ENG, CN
  catalog: string; // nhóm câu hỏi, vd TOIEC, HSK1
  title: string; // tên hiển thị của bài, vd TEST
  timeLimitMin: number; // giới hạn thời gian (phút)
  enableAI: boolean; // true = tự động chấm câu tự luận bằng AI
}

export interface Candidate {
  name: string;
  email: string;
}

// Đáp án người dùng: choice = mảng letter đã chọn, fill = chuỗi đã nhập
export type ChoiceAnswers = Record<string, string[]>;
export type FillAnswers = Record<string, string>;

export interface PerQuestionResult {
  id: string;
  question: string;
  correct: boolean;
}

// Câu tự luận: tách riêng khỏi điểm tự động, lưu nội dung trả lời để chấm (AI hoặc tay)
export interface EssayAnswer {
  id: string;
  question: string;
  answer: string;
  modelAnswer?: string; // đáp án mẫu (nếu sheet có) để AI tham chiếu
  suggestion?: string; // gợi ý (nếu có)
}

// Kết quả chấm câu tự luận (server bổ sung sau khi gọi AI hoặc để chấm tay)
export interface EssayGrade extends EssayAnswer {
  graded: boolean; // AI đã chấm chưa
  pass?: boolean; // AI: đạt / chưa đạt
  comment?: string; // nhận xét
}

export interface TestResult {
  score: number;
  total: number;
  percent: number;
  durationSec: number;
  durationText: string;
  submittedAt: number; // epoch ms
  perQuestion: PerQuestionResult[];
  essays: EssayAnswer[]; // câu tự luận (không tính vào score tự động)
}

// Phiên làm bài, lưu trong localStorage để giữ session khi refresh
export interface Session {
  candidate: Candidate;
  config: TestConfig;
  startAt: number; // epoch ms khi bấm Bắt đầu
  choice: ChoiceAnswers;
  fill: FillAnswers;
  phase: "testing" | "result";
  result?: TestResult;
}
