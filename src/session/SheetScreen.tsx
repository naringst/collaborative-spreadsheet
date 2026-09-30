"use client";

import { useCallback, useMemo, useState } from "react";
import { ParticipantList, RemoteSelectionOverlay } from "@/features/collab";
import { SheetGrid, SheetToolbar, type GridCursor } from "@/features/sheet";
import { SheetSessionProvider, useSheetSession } from "./SheetSession";

const INITIAL_CURSOR: GridCursor = {
  range: { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } },
  editing: null,
};

function SheetWorkspace() {
  const session = useSheetSession();

  // 훅 순서 유지를 위해 분기 위에서 선언 — loading이면 presence가 없어 no-op
  const presence = session.status === "ready" ? session.presence : null;
  // 선택 원본은 Grid 내부(useSelection) 한 곳이고, 여기는 awareness 복사와 같은
  // 단방향 미러 — 툴바가 서식 대상 범위·눌린 상태를 알기 위해 필요하다 (S4)
  const [cursor, setCursor] = useState<GridCursor>(INITIAL_CURSOR);
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
    () => (presence ? <RemoteSelectionOverlay presence={presence} /> : null),
    [presence],
  );

  if (session.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        시트를 불러오는 중…
      </div>
    );
  }

  const { store, undo, storageWarning } = session;
  return (
    // 시트 화면은 라이트 팔레트 고정 — OS 다크 모드의 전역 배경·글자색을 덮는다
    <div className="flex h-full flex-col bg-white text-gray-900">
      {storageWarning && (
        <div className="border-b border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
          브라우저 저장소를 사용할 수 없어 변경 사항이 저장되지 않습니다.
        </div>
      )}
      <div className="flex items-center justify-between border-b border-gray-200">
        <SheetToolbar store={store} undo={undo} cursor={cursor} />
        {presence && <ParticipantList presence={presence} />}
      </div>
      <div className="min-h-0 flex-1">
        <SheetGrid
          store={store}
          undo={undo}
          overlay={overlay}
          onPresenceChange={onPresenceChange}
        />
      </div>
    </div>
  );
}

/** 세션과 그리드·툴바·참여자 목록을 조립한 시트 편집 화면 */
export function SheetScreen({ sheetId }: { sheetId?: string }) {
  return (
    <SheetSessionProvider sheetId={sheetId}>
      <SheetWorkspace />
    </SheetSessionProvider>
  );
}
