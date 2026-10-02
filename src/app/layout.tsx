import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { SheetListSessionProvider, SheetListSidebar } from "@/composition";
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
      <body className="h-full">
        {/* 목록 세션을 루트에서 한 번만 만들어 / 와 /sheet/[id]가 같은 registry doc을
            공유한다 — 생성 직후 이동해도 게이트가 즉시 시트를 보고, 화면 전환에
            provider가 끊기지 않는다. 사이드바도 이 세션을 구독해 모든 페이지에서
            목록을 보여 준다 */}
        <SheetListSessionProvider>
          <div className="flex h-dvh">
            <SheetListSidebar />
            <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
          </div>
        </SheetListSessionProvider>
      </body>
    </html>
  );
}
