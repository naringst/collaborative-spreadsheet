"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { SheetList, type SheetListStore } from "@/features/sheet-list";
import { CenteredNotice, StorageWarningBanner } from "@/shared/ui/Notice";
import { useSheetListSession } from "./SheetListSession";

const NO_SHEETS: never[] = [];

function ListWithStore({ listStore }: { listStore: SheetListStore }) {
  const router = useRouter();
  const sheets = useSyncExternalStore(
    listStore.subscribe,
    listStore.getSheets,
    () => NO_SHEETS,
  );

  return (
    <SheetList
      sheets={sheets}
      onCreate={() => {
        // 생성 즉시 편집 화면으로 이동한다 (S8). registry doc이 루트에서 공유되므로
        // 이동한 게이트가 방금 만든 시트를 바로 본다 — 이름은 목록에서 나중에 변경
        const id = listStore.createSheet();
        router.push(`/sheet/${id}`);
      }}
      onRename={(id, name) => listStore.renameSheet(id, name)}
      sheetHref={(id) => `/sheet/${id}`}
    />
  );
}

/** `/` — 시트 목록 화면 (목록 세션은 루트 레이아웃에서 제공) */
export function SheetListScreen() {
  const session = useSheetListSession();
  if (session.status === "loading") {
    return (
      <div className="h-dvh bg-white text-gray-900">
        <CenteredNotice>시트 목록을 불러오는 중…</CenteredNotice>
      </div>
    );
  }
  return (
    <div className="h-dvh bg-white text-gray-900">
      {session.storageWarning && <StorageWarningBanner />}
      <ListWithStore listStore={session.listStore} />
    </div>
  );
}
