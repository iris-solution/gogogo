// Loại câu hỏi gốc trong Google Sheets
export type RawType =
  | "TrueFalse"
  | "MultipleChoice"
  | "Normal"
  | "Passage"
  | "FillBlank";

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

// Câu điền vào chỗ trống
export interface FillQuestion extends Base {
  kind: "fill";
  accepted: string[]; // các đáp án được chấp nhận
  suggestions: string[]; // gợi ý hiển thị
}

export type Answerable = ChoiceQuestion | FillQuestion;

// Đoạn văn (câu cha) chứa các câu con
export interface PassageQuestion extends Base {
  kind: "passage";
  children: Answerable[];
}

export type QuizItem = Answerable | PassageQuestion;
