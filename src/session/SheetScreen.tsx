"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { AiPanel, AiTargetOverlay } from "@/features/ai";
import { ParticipantList, RemoteSelectionOverlay } from "@/features/collab";
import {
  SheetGrid,
  SheetToolbar,
  ToolbarSeparator,
  isSingleCell,
  normalizeRange,
  rangeLabel,
  type GridCursor,
} from "@/features/sheet";
import { CenteredNotice, StorageWarningBanner } from "@/shared/ui/Notice";
import { useSheetListSession } from "./SheetListSession";
import { SheetSessionProvider, useSheetSession } from "./SheetSession";

const NOOP_SUBSCRIBE = () => () => {};

const INITIAL_CURSOR: GridCursor = {
  range: { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } },
  editing: null,
};

function SheetWorkspace({ sheetId }: { sheetId?: string }) {
  const session = useSheetSession();
  const listSession = useSheetListSession();
  const listStore =
    listSession.status === "ready" ? listSession.listStore : null;
  // 제목은 목록 doc이 원본 — 다른 탭에서 이름을 바꾸면 여기도 따라간다
  const sheetName = useSyncExternalStore(
    listStore?.subscribe ?? NOOP_SUBSCRIBE,
    () => (sheetId && listStore?.getSheet(sheetId)?.name) || "",
    () => "",
  );

  // 훅 순서 유지를 위해 분기 위에서 선언 — loading이면 presence가 없어 no-op
  const presence = session.status === "ready" ? session.presence : null;
  const proposalStore =
    session.status === "ready" ? session.proposalStore : null;
  // 선택 원본은 Grid 내부(useSelection) 한 곳이고, 여기는 awareness 복사와 같은
  // 단방향 미러 — 툴바가 서식 대상 범위·눌린 상태를 알기 위해 필요하다 (S4)
  const [cursor, setCursor] = useState<GridCursor>(INITIAL_CURSOR);
  // AI 패널은 필요할 때만 연다 — 기본은 그리드가 폭을 모두 쓴다
  const [aiOpen, setAiOpen] = useState(false);
  const onPresenceChange = useCallback(
    (next: GridCursor) => {
      setCursor(next);
      presence?.setCursor(next);
    },
    [presence],
  );
  // 커서 미러 setState가 매 선택 변경마다 이 컴포넌트를 리렌더하므로,
  // overlay 엘리먼트를 고정해 memo된 SheetGrid가 두 번 렌더되지 않게 한다
  const overlay = useMemo(
    () => (
      <>
        {presence && <RemoteSelectionOverlay presence={presence} />}
        {proposalStore && <AiTargetOverlay proposalStore={proposalStore} />}
      </>
    ),
    [presence, proposalStore],
  );

  if (session.status === "loading") {
    return <CenteredNotice>시트를 불러오는 중…</CenteredNotice>;
  }

  const { store, undo, storageWarning } = session;
  const norm = normalizeRange(cursor.range);
  const cellCount = (norm.bottom - norm.top + 1) * (norm.right - norm.left + 1);

  return (
    // 시트 화면은 라이트 팔레트 고정 — OS 다크 모드의 전역 배경·글자색을 덮는다
    <div className="bg-surface text-ink flex h-full flex-col">
      {storageWarning && <StorageWarningBanner />}
      <SheetToolbar
        store={store}
        undo={undo}
        cursor={cursor}
        leading={
          sheetName && (
            <h2 className="text-ink truncate text-[14px] font-semibold tracking-tight">
              {sheetName}
            </h2>
          )
        }
        trailing={
          <>
            {presence && <ParticipantList presence={presence} />}
            {proposalStore && (
              <>
                <ToolbarSeparator />
                <button
                  type="button"
                  aria-pressed={aiOpen}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium ${
                    aiOpen
                      ? "bg-accent text-surface"
                      : "bg-accent-soft text-accent hover:brightness-95"
                  }`}
                  onClick={() => setAiOpen((v) => !v)}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M8 1.5 9.6 6l4.4 1.6L9.6 9.2 8 13.7 6.4 9.2 2 7.6 6.4 6z" />
                  </svg>
                  AI 편집
                </button>
              </>
            )}
          </>
        }
      />
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1">
          <SheetGrid
            store={store}
            undo={undo}
            overlay={overlay}
            onPresenceChange={onPresenceChange}
          />
        </div>
        {proposalStore && (
          // 폭만 트랜지션하고 패널은 항상 마운트해 둔다 — 닫았다 열어도 입력 중이던
          // 프롬프트가 남고, 접힌 동안은 inert로 포커스·클릭을 막는다
          <div
            className={`shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out ${
              aiOpen ? "w-80" : "w-0"
            }`}
            inert={!aiOpen}
          >
            <AiPanel
              proposalStore={proposalStore}
              cursor={cursor}
              onClose={() => setAiOpen(false)}
            />
          </div>
        )}
      </div>
      <div className="border-line bg-surface-2 text-ink-3 flex h-8 shrink-0 items-center gap-3 border-t px-3 text-[11.5px]">
        <span className="border-line bg-surface text-ink-2 rounded border px-1.5 font-mono text-[11px]">
          {rangeLabel(cursor.range)}
        </span>
        {!isSingleCell(cursor.range) && <span>{cellCount}개 셀</span>}
        {cursor.editing && <span>입력 중</span>}
      </div>
    </div>
  );
}

/** 세션과 그리드·툴바·참여자 목록을 조립한 시트 편집 화면 */
export function SheetScreen({ sheetId }: { sheetId?: string }) {
  return (
    <SheetSessionProvider sheetId={sheetId}>
      <SheetWorkspace sheetId={sheetId} />
    </SheetSessionProvider>
  );
}
