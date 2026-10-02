import {
  cellKey,
  rangeLabel,
  type CellAddress,
  type CellRange,
  type CellSnapshot,
  type GridCursor,
  type SheetStore,
  type SheetUndo,
} from "@/features/sheet";
import { buildContext, type AiContext } from "../model/context";
import {
  AiError,
  canApply,
  type AiErrorKind,
  type CellResolution,
  type ProposalCell,
  type ProposalStatus,
} from "../model/proposal";
import { parseProposalItem } from "../model/proposal-schema";

/**
 * 제안 생성 소스. 실제 구현은 openrouter-source(스트리밍 클라이언트)다.
 * onItem에 원시 항목을 하나씩 넘기면 store가 검증·누적한다(A4). 실패는
 * AiError(kind)로 throw하면 store가 세션 error로 표면화한다(A6).
 */
export type ProposalSource = (
  input: {
    prompt: string;
    context: AiContext;
    /** 범위 지정 요청이면 "B2:D10", 시트 전체면 null (A2/D8) */
    targetLabel: string | null;
  },
  onItem: (raw: unknown) => void,
  signal: AbortSignal,
) => Promise<void>;

export interface ProposalSession {
  status: ProposalStatus;
  prompt: string;
  /** 요청 대상 범위. null이면 시트 전체 (D8) */
  targetRange: CellRange | null;
  cells: ProposalCell[];
  /** status가 "error"일 때의 실패 종류 (A6), 그 외엔 null */
  error: AiErrorKind | null;
}

interface StartOpts {
  prompt: string;
  targetRange: CellRange | null;
  cursor: GridCursor;
}

export interface ProposalStore {
  start(opts: StartOpts): void;
  /** 생성 중단 — 부분 제안은 확인만 가능, 적용 불가 (A4/D10) */
  cancel(): void;
  /** 직전 요청을 같은 입력으로 다시 생성 (A6 "같은 요청으로 재시도") */
  retry(): void;
  /** 충돌 셀의 처리 선택 — keep(현재 유지) / ai(AI 값 적용) (X1) */
  setResolution(addr: CellAddress, resolution: CellResolution): void;
  apply(): void;
  discard(): void;
  getSession(): ProposalSession | null;
  subscribe(listener: () => void): () => void;
  destroy(): void;
}

// 요청 시점 스냅샷에서 "주소 → 그때의 값" 조회를 만든다 — 이후 시트가 바뀌어도
// base는 불변이라 적용 시 충돌 판정의 기준이 된다 (X1).
function makeBaseLookup(
  snapshot: CellSnapshot[],
): (addr: CellAddress) => string {
  const byKey = new Map(snapshot.map((c) => [cellKey(c.addr), c.value]));
  return (addr) => byKey.get(cellKey(addr)) ?? "";
}

// 적용할 셀 변경을 계산한다 (X1): 충돌 없으면 AI 값, 충돌이면 사용자 선택을 따른다
// — keep=현재 값 유지(쓰지 않음), base=원래 값 복원, ai=AI 값.
function resolveChanges(
  cells: ProposalCell[],
): { addr: CellAddress; value: string }[] {
  return cells.flatMap((c) => {
    if (!c.conflict || c.resolution === "ai") {
      return [{ addr: c.addr, value: c.proposedValue }];
    }
    if (c.resolution === "base") return [{ addr: c.addr, value: c.baseValue }];
    return []; // keep
  });
}

export function createProposalStore(deps: {
  store: SheetStore;
  undo: SheetUndo;
  source: ProposalSource;
}): ProposalStore {
  const { store, undo, source } = deps;
  let session: ProposalSession | null = null;
  let abort: AbortController | null = null;
  let lastStart: StartOpts | null = null;
  let destroyed = false;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  // 세션 일부 필드를 바꾸고 구독자에게 알린다. 세션이 없으면 아무 일도 안 한다.
  // (새 세션 생성·세션 종료는 session을 직접 대입한다.)
  const patchSession = (patch: Partial<ProposalSession>) => {
    if (!session) return;
    session = { ...session, ...patch };
    notify();
  };

  // 세션 cells를 map으로 변환하고, 바뀐 셀이 하나라도 있으면 패치한다. map이
  // 같은 참조를 돌려준 셀은 "변경 없음"으로 보므로 불필요한 notify를 피한다.
  const updateCells = (map: (cell: ProposalCell) => ProposalCell) => {
    if (!session) return;
    let changed = false;
    const cells = session.cells.map((cell) => {
      const next = map(cell);
      if (next !== cell) changed = true;
      return next;
    });
    if (changed) patchSession({ cells });
  };

  // 셀의 현재 시트 값·충돌 여부를 다시 읽는다 (X1). 바뀐 게 없으면 같은 객체를
  // 그대로 돌려줘 updateCells가 변경 없음으로 처리하게 한다. resolution은 보존.
  const liveCell = (cell: ProposalCell): ProposalCell => {
    const currentValue = store.getCellValue(cell.addr);
    const conflict = currentValue !== cell.baseValue;
    if (currentValue === cell.currentValue && conflict === cell.conflict) {
      return cell;
    }
    return { ...cell, currentValue, conflict };
  };

  // 검토 중 다른 참여자가 대상 셀을 바꾸면 충돌 표시를 실시간 갱신한다 (X1).
  // 세션이 없으면(적용 후) updateCells가 no-op이다.
  const recomputeConflicts = () => updateCells(liveCell);
  const unsubscribeStore = store.subscribe(recomputeConflicts);

  const run = (opts: StartOpts) => {
    if (destroyed) return; // 해제된 store는 재가동하지 않는다
    const { prompt, targetRange, cursor } = opts;
    abort?.abort(); // 진행 중이던 요청은 취소하고 새로 시작
    lastStart = opts;

    const snapshot = store.snapshotValues();
    const base = makeBaseLookup(snapshot);

    session = {
      status: "generating",
      prompt,
      targetRange,
      cells: [],
      error: null,
    };
    notify();

    const controller = new AbortController();
    abort = controller;
    const context = buildContext(snapshot, cursor);
    const targetLabel = targetRange ? rangeLabel(targetRange) : null;

    const onItem = (raw: unknown) => {
      if (controller.signal.aborted || !session) return;
      const parsed = parseProposalItem(raw, base, targetRange);
      // 이미 원격 변경이 있었다면 추가 시점에 바로 충돌로 표시한다 (X1)
      if (parsed) patchSession({ cells: [...session.cells, liveCell(parsed)] });
    };

    source({ prompt, context, targetLabel }, onItem, controller.signal)
      .then(() => {
        if (controller.signal.aborted || !session) return;
        patchSession({ status: "complete" });
      })
      .catch((err: unknown) => {
        // 취소·교체로 인한 abort는 cancel()/다음 run이 상태를 책임진다
        if (controller.signal.aborted || !session) return;
        const kind: AiErrorKind = err instanceof AiError ? err.kind : "network";
        // 받은 부분 제안은 남겨 확인만 가능하게 둔다 (A6)
        patchSession({ status: "error", error: kind });
      });
  };

  return {
    start: run,

    cancel() {
      if (!session || session.status !== "generating") return;
      abort?.abort();
      patchSession({ status: "cancelled" });
    },

    retry() {
      if (!lastStart) return;
      run(lastStart);
    },

    setResolution(addr, resolution) {
      // 해당 셀만 선택을 바꾼다 (나머지는 같은 참조라 updateCells가 건너뛴다)
      const key = cellKey(addr);
      updateCells((cell) =>
        cellKey(cell.addr) === key && cell.resolution !== resolution
          ? { ...cell, resolution }
          : cell,
      );
    },

    apply() {
      if (!session || !canApply(session.status)) return;
      abort?.abort(); // 완료됐어도 열린 스트림이 있으면 정리
      const changes = resolveChanges(session.cells);
      // 쓰기 전에 세션을 비운다 — applyCellValues가 store 구독(recomputeConflicts)을
      // 동기로 깨우는데, 그때 세션이 살아 있으면 방금 쓴 값을 충돌로 오인한다.
      session = null;
      // 앞뒤로 undo 경계를 둬 직전·직후 입력과 한 단계로 합쳐지지 않게 한다 (A5).
      undo.stopCapturing();
      store.applyCellValues(changes);
      undo.stopCapturing();
      notify();
    },

    discard() {
      abort?.abort();
      session = null;
      notify();
    },

    getSession: () => session,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    destroy() {
      destroyed = true;
      abort?.abort();
      unsubscribeStore();
      listeners.clear();
      session = null;
    },
  };
}
