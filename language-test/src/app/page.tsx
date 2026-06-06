import Quiz from "@/components/Quiz";
import { fetchQuestions } from "@/lib/sheet";

// ISR: trang được dựng tĩnh và làm mới dữ liệu từ Google Sheets mỗi 60s
export const revalidate = 60;

export default async function Home() {
  let items;
  try {
    items = await fetchQuestions();
  } catch (err) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-red-600">
          Không tải được dữ liệu
        </h1>
        <p className="mt-2 text-zinc-500">
          {err instanceof Error ? err.message : "Lỗi không xác định"}
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Kiểm tra Google Sheet đã được chia sẻ công khai (Anyone with the
          link).
        </p>
      </main>
    );
  }

  if (!items.length) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center text-zinc-500">
        Chưa có câu hỏi nào trong sheet.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">
          Bài kiểm tra ngôn ngữ
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {items.length} mục · Làm hết rồi bấm <strong>Nộp bài</strong> để xem
          điểm và đáp án.
        </p>
      </header>
      <Quiz items={items} />
    </main>
  );
}
