import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { SheetListSessionProvider } from "@/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Collaborative Spreadsheet",
  description: "탭 간 공동편집과 AI 편집을 지원하는 스프레드시트",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* 목록 세션을 루트에서 한 번만 만들어 / 와 /sheet/[id]가 같은 registry doc을
            공유한다 — 생성 직후 이동해도 게이트가 즉시 시트를 보고, 화면 전환에
            provider가 끊기지 않는다 */}
        <SheetListSessionProvider>{children}</SheetListSessionProvider>
      </body>
    </html>
  );
}
