import { SheetScreen } from "@/session";

// S8 전 임시 화면: 루트에서 바로 시트를 연다. 시트 목록이 생기면 /sheet/[id]로 옮긴다.
export default function Home() {
  return (
    <main className="h-dvh">
      <SheetScreen />
    </main>
  );
}
