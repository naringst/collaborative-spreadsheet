import {
  cellKey,
  type CellAddress,
  type CellRange,
  type GridCursor,
  type SheetStore,
  type SheetUndo,
} from "@/features/sheet";
import { buildContext, type AiContext } from "../model/context";
import {
  canApply,
  type ProposalCell,
  type ProposalStatus,
} from "../model/proposal";
import { parseProposalItem } from "../model/proposal-schema";

/**
 * 제안 생성 소스. 묶음 1은 mock, 묶음 2에서 스트리밍 클라이언트로 교체한다.
 * onItem에 원시 항목을 하나씩 넘기면 store가 검증·누적한다 (A4 대비).
 */
export type ProposalSource = (
  input: { prompt: string; context: AiContext },
  onItem: (raw: unknown) => void,
  signal: AbortSignal,
) => Promise<void>;

export interface ProposalSession {
  status: ProposalStatus;
  prompt: string;
  /** 요청 대상 범위. null이면 시트 전체 (D8) */
  targetRange: CellRange | null;
  cells: ProposalCell[];
}

export interface ProposalStore {
  start(opts: {
    prompt: string;
    targetRange: CellRange | null;
    cursor: GridCursor;
  }): void;
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
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    start({ prompt, targetRange, cursor }) {
      abort?.abort(); // 진행 중이던 요청은 취소하고 새로 시작
      // 요청 시점의 값을 base로 고정한다 (X1). 이후 store가 바뀌어도 base는 불변.
      const snapshot = store.snapshotValues();
      const baseByKey = new Map(
        snapshot.map((c) => [cellKey(c.addr), c.value]),
      );
      const base = (addr: CellAddress) => baseByKey.get(cellKey(addr)) ?? "";

      session = { status: "generating", prompt, targetRange, cells: [] };
      notify();

      const controller = new AbortController();
      abort = controller;
      const context = buildContext(snapshot, cursor);

      const onItem = (raw: unknown) => {
        if (controller.signal.aborted || !session) return;
        const cell = parseProposalItem(raw, base, targetRange);
        if (cell) {
          session = { ...session, cells: [...session.cells, cell] };
          notify();
        }
      };

      source({ prompt, context }, onItem, controller.signal)
        .then(() => {
          if (controller.signal.aborted || !session) return;
          session = { ...session, status: "complete" };
          notify();
        })
        .catch(() => {
          // 실패 분류·표시는 묶음 2. mock 소스는 실패하지 않는다.
        });
    },

    apply() {
      if (!session || !canApply(session.status)) return;
      abort?.abort(); // 완료됐어도 열린 스트림(묶음 2)이 있으면 정리
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
      abort?.abort();
      listeners.clear();
      session = null;
    },
  };
}
