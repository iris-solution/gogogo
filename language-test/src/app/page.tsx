import App from "@/components/App";
import { fetchConfig } from "@/lib/sheet";

export const revalidate = 60;

export default async function Home() {
  let configs;
  try {
    configs = await fetchConfig();
  } catch (err) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-red-600">
          Không tải được cấu hình bài test
        </h1>
        <p className="mt-2 text-zinc-500">
          {err instanceof Error ? err.message : "Lỗi không xác định"}
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Kiểm tra tab <code>config</code> và quyền chia sẻ của Google Sheet.
        </p>
      </main>
    );
  }

  if (!configs.length) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center text-zinc-500">
        Chưa có bài test nào trong tab <code>config</code>.
      </main>
    );
  }

  return <App configs={configs} />;
}
