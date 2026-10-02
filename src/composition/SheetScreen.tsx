"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { AiPanel, AiTargetOverlay } from "@/features/ai";
import {
  EMPTY_PARTICIPANTS,
  ParticipantList,
  RemoteAiTaskOverlay,
  RemoteSelectionOverlay,
  isAiTaskPayload,
  type AiTaskPayload,
} from "@/features/collab";
import {
  SheetGrid,
  SheetGridSkeleton,
  SheetToolbar,
  SheetToolbarSkeleton,
  ToolbarSeparator,
  isSingleCell,
  normalizeRange,
  rangeLabel,
  rangeOverlaps,
  type GridCursor,
} from "@/features/sheet";
import { StorageWarningBanner } from "@/shared/ui/Notice";
import { SparkIcon } from "@/shared/ui/icons";
import { SheetSessionProvider, useSheetSession } from "./SheetSession";

const INITIAL_CURSOR: GridCursor = {
  range: { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } },
  editing: null,
};

// useSyncExternalStore에 넘길 안정 참조 — presence·proposalStore가 없을 때(loading)
const NO_SUBSCRIBE = () => () => {};
const NO_SESSION = () => null;
const GET_NO_PARTICIPANTS = () => EMPTY_PARTICIPANTS;

function SheetWorkspace() {
  const session = useSheetSession();

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

  // 내 AI 세션의 단계·대상 범위를 구독해 다른 탭에 작업 표시를 발행한다 (X2),
  // 그리고 다른 참여자의 작업과 겹치는지 경고한다 (X3).
  const aiSession = useSyncExternalStore(
    proposalStore?.subscribe ?? NO_SUBSCRIBE,
    proposalStore?.getSession ?? NO_SESSION,
    NO_SESSION,
  );
  const participants = useSyncExternalStore(
    presence?.subscribe ?? NO_SUBSCRIBE,
    presence?.getParticipants ?? GET_NO_PARTICIPANTS,
    GET_NO_PARTICIPANTS,
  );

  const aiPhase: AiTaskPayload["phase"] | null =
    aiSession?.status === "generating"
      ? "generating"
      : aiSession?.status === "complete"
        ? "reviewing"
        : null;
  const aiTargetRange = aiSession?.targetRange ?? null;
  useEffect(() => {
    presence?.setAiTask(aiPhase ? { range: aiTargetRange, phase: aiPhase } : null);
  }, [presence, aiPhase, aiTargetRange]);

  // 내 선택과 겹치는 범위에서 AI 작업 중인 참여자 (X3). 단일 셀 선택을 시트
  // 전체로 부풀리지 않는다 — 멀리 떨어진 작업까지 경고하면 노이즈가 된다.
  // 범위 미지정으로 보낸 요청이 실제로 겹쳐 충돌하는 경우는 적용 시 X1이 잡는다.
  // 상대가 시트 전체 작업(range=null) 중이면 어느 셀이든 겹치므로 경고한다.
  const overlapper = participants.find(
    (p) =>
      !p.isLocal &&
      isAiTaskPayload(p.aiTask) &&
      (p.aiTask.range === null || rangeOverlaps(p.aiTask.range, cursor.range)),
  );
  const overlapWarning = overlapper
    ? `${overlapper.name}님이 이 범위에서 AI 작업 중입니다`
    : null;

  // 커서 미러 setState가 매 선택 변경마다 이 컴포넌트를 리렌더하므로,
  // overlay 엘리먼트를 고정해 memo된 SheetGrid가 두 번 렌더되지 않게 한다
  const overlay = useMemo(
    () => (
      <>
        {presence && <RemoteSelectionOverlay presence={presence} />}
        {presence && <RemoteAiTaskOverlay presence={presence} />}
        {proposalStore && <AiTargetOverlay proposalStore={proposalStore} />}
      </>
    ),
    [presence, proposalStore],
  );

  if (session.status === "loading") {
    // 서식 줄·행열 헤더는 그대로 두고 셀 영역만 로딩으로 — 시트 전환이 덜 튄다 (S6)
    return (
      <div className="bg-surface text-ink flex h-full flex-col">
        <SheetToolbarSkeleton />
        <div className="min-h-0 flex-1">
          <SheetGridSkeleton />
        </div>
        <div className="border-line bg-surface-2 text-ink-3 flex h-8 shrink-0 items-center border-t px-3 text-[11.5px]">
          불러오는 중…
        </div>
      </div>
    );
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
                  <SparkIcon />
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
              overlapWarning={overlapWarning}
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
      <SheetWorkspace />
    </SheetSessionProvider>
  );
}
