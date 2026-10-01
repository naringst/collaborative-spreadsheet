import {
  cellKey,
  rangeLabel,
  type CellAddress,
  type CellRange,
  type GridCursor,
  type SheetStore,
  type SheetUndo,
} from "@/features/sheet";
import { buildContext, type AiContext } from "../model/context";
import {
  AiError,
  canApply,
  type AiErrorKind,
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
  apply(): void;
  discard(): void;
  getSession(): ProposalSession | null;
  subscribe(listener: () => void): () => void;
  destroy(): void;
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

  const run = (opts: StartOpts) => {
    if (destroyed) return; // 해제된 store는 재가동하지 않는다
    const { prompt, targetRange, cursor } = opts;
    abort?.abort(); // 진행 중이던 요청은 취소하고 새로 시작
    lastStart = opts;

    // 요청 시점의 값을 base로 고정한다 (X1). 이후 store가 바뀌어도 base는 불변.
    const snapshot = store.snapshotValues();
    const baseByKey = new Map(snapshot.map((c) => [cellKey(c.addr), c.value]));
    const base = (addr: CellAddress) => baseByKey.get(cellKey(addr)) ?? "";

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
      const cell = parseProposalItem(raw, base, targetRange);
      if (cell) {
        session = { ...session, cells: [...session.cells, cell] };
        notify();
      }
    };

    source({ prompt, context, targetLabel }, onItem, controller.signal)
      .then(() => {
        if (controller.signal.aborted || !session) return;
        session = { ...session, status: "complete" };
        notify();
      })
      .catch((err: unknown) => {
        // 취소·교체로 인한 abort는 cancel()/다음 run이 상태를 책임진다
        if (controller.signal.aborted || !session) return;
        const kind: AiErrorKind = err instanceof AiError ? err.kind : "network";
        // 받은 부분 제안은 남겨 확인만 가능하게 둔다 (A6)
        session = { ...session, status: "error", error: kind };
        notify();
      });
  };

  return {
    start: run,

    cancel() {
      if (!session || session.status !== "generating") return;
      abort?.abort();
      session = { ...session, status: "cancelled" };
      notify();
    },

    retry() {
      if (!lastStart) return;
      run(lastStart);
    },

    apply() {
      if (!session || !canApply(session.status)) return;
      abort?.abort(); // 완료됐어도 열린 스트림이 있으면 정리
      // 앞뒤로 undo 경계를 둬 직전·직후 입력과 한 단계로 합쳐지지 않게 한다 (A5).
      // captureTimeout 0에 더해 정책과 무관하게 경계를 고정한다.
      undo.stopCapturing();
      store.applyCellValues(
        session.cells.map((c) => ({ addr: c.addr, value: c.proposedValue })),
      );
      undo.stopCapturing();
      session = null; // 적용된 제안은 시트에 반영됐으므로 세션 종료
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
      listeners.clear();
      session = null;
    },
  };
}
