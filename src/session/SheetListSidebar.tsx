"use client";

import { useRouter, useSelectedLayoutSegments } from "next/navigation";
import { useSyncExternalStore } from "react";
import { SheetList, type SheetListStore } from "@/features/sheet-list";
import { StorageWarningBanner } from "@/shared/ui/Notice";
import { useSheetListSession } from "./SheetListSession";

const NO_SHEETS: never[] = [];

// 접힘 선호는 순수 UI 상태 — localStorage에 저장하고 외부 스토어로 구독한다
// (이 저장소 전반의 useSyncExternalStore 규약을 따르고, 하이드레이션도 안전하다)
const COLLAPSED_KEY = "sheet-sidebar-collapsed";
const collapseListeners = new Set<() => void>();

function readCollapsed() {
  return localStorage.getItem(COLLAPSED_KEY) === "1";
}
function setCollapsed(next: boolean) {
  localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  collapseListeners.forEach((l) => l());
}
function subscribeCollapsed(listener: () => void) {
  collapseListeners.add(listener);
  return () => collapseListeners.delete(listener);
}

function ListWithStore({
  listStore,
  activeSheetId,
  collapsed,
  onToggleCollapse,
}: {
  listStore: SheetListStore;
  activeSheetId?: string;
  collapsed: boolean;
  onToggleCollapse(): void;
}) {
  const router = useRouter();
  const sheets = useSyncExternalStore(
    listStore.subscribe,
    listStore.getSheets,
    () => NO_SHEETS,
  );

  return (
    <SheetList
      sheets={sheets}
      activeSheetId={activeSheetId}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
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

/** 모든 페이지 좌측에 고정되는 시트 목록 사이드바 (루트 레이아웃에서 마운트) */
export function SheetListSidebar() {
  const session = useSheetListSession();
  // `/sheet/[id]` 에서 세그먼트는 ["sheet", "<id>"] — 현재 열린 시트를 활성 표시한다
  const segments = useSelectedLayoutSegments();
  const activeSheetId = segments[0] === "sheet" ? segments[1] : undefined;

  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => false,
  );
  const toggle = () => setCollapsed(!collapsed);

  return (
    // 폭만 트랜지션하고 내용(w-64)은 그대로 두면 접힐 때 토글만 남고 나머지는 가려진다
    <aside
      className={`border-line bg-surface-2 text-ink shrink-0 overflow-hidden border-r transition-[width] duration-200 ease-in-out ${
        collapsed ? "w-11" : "w-56"
      }`}
    >
      {session.status === "loading" ? (
        <div className="flex h-11 items-center gap-1.5 px-2">
          <button
            type="button"
            className="text-ink-2 hover:bg-surface-3 grid h-7 w-7 shrink-0 place-items-center rounded-md"
            onClick={toggle}
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          >
            «
          </button>
          <span className="text-ink-3 text-[13px] whitespace-nowrap">
            불러오는 중…
          </span>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          {session.storageWarning && <StorageWarningBanner />}
          <ListWithStore
            listStore={session.listStore}
            activeSheetId={activeSheetId}
            collapsed={collapsed}
            onToggleCollapse={toggle}
          />
        </div>
      )}
    </aside>
  );
}
