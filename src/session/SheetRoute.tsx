"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { SheetListStore } from "@/features/sheet-list";
import { CenteredNotice } from "@/shared/ui/Notice";
import { useSheetListSession } from "./SheetListSession";
import { SheetScreen } from "./SheetScreen";

function SheetGate({
  sheetId,
  listStore,
}: {
  sheetId: string;
  listStore: SheetListStore;
}) {
  // 구독을 유지한다 — 다른 탭이 방금 만든 시트의 동기화가 늦게 도착하면
  // "찾을 수 없음"에서 편집 화면으로 자동 전환된다
  const exists = useSyncExternalStore(
    listStore.subscribe,
    () => listStore.hasSheet(sheetId),
    () => false,
  );

  if (!exists) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <p className="text-sm text-gray-600">시트를 찾을 수 없습니다.</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          시트 목록으로 돌아가기
        </Link>
      </div>
    );
  }
  return <SheetScreen sheetId={sheetId} />;
}

/**
 * `/sheet/[id]` 게이트: 목록에서 id 존재를 확인한 뒤에만 시트 세션을 마운트한다 —
 * 없는 id 접속이 빈 IndexedDB(sheet-{id})를 만들지 않게 (S8).
 * 목록 세션은 루트 레이아웃에서 제공되어 목록 화면과 공유된다.
 */
export function SheetRoute({ sheetId }: { sheetId: string }) {
  const session = useSheetListSession();
  return (
    <div className="h-dvh bg-white text-gray-900">
      {session.status === "loading" ? (
        // 목록 로드 전에는 존재 여부를 판정할 수 없다 (S6 깜빡임 방지와 동일 원칙)
        <CenteredNotice>시트를 불러오는 중…</CenteredNotice>
      ) : (
        <SheetGate sheetId={sheetId} listStore={session.listStore} />
      )}
    </div>
  );
}
