import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bài kiểm tra ngôn ngữ",
  description: "Luyện tập kỹ năng ngôn ngữ với câu hỏi lấy từ Google Sheets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="mt-8 border-t border-orange-100 bg-white/60 backdrop-blur">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 px-4 py-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo/paihong.png"
              alt="PAIHO"
              className="h-6 w-auto rounded opacity-90"
            />
            <p className="text-xs text-zinc-500">
              Thực hiện bởi{" "}
              <span className="font-semibold text-zinc-700">
                Nguyễn Thị Xuân Hồng
              </span>
            </p>
            <p className="text-xs text-zinc-400">
              © {new Date().getFullYear()} PAIHO. Bản quyền bởi IRIS.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
