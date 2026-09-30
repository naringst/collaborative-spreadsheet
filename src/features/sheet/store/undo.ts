import * as Y from "yjs";
import { parseCellKey, type CellAddress } from "../model/cell";
import { LOCAL_ORIGIN } from "./sheet-store";

export interface SheetUndo {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** 스택 변화(버튼 활성/비활성) 구독 (S5) */
  subscribe(listener: () => void): () => void;
  /** undo/redo가 되돌린 셀 하나를 통지 — 선택 이동용 (S5 P1) */
  onReverted(cb: (addr: CellAddress | null) => void): () => void;
  destroy(): void;
}

export function createSheetUndo(doc: Y.Doc): SheetUndo {
  const cells = doc.getMap("cells");
  // captureTimeout 0: 빠른 연속 확정이 한 undo 단계로 합쳐지지 않는다 (S5 "확정 1회 = 1단계")
  const manager = new Y.UndoManager(cells, {
    trackedOrigins: new Set([LOCAL_ORIGIN]), // 내 변경만 되돌린다 (C7)
    captureTimeout: 0,
  });

  const revertedCbs = new Set<(addr: CellAddress | null) => void>();

  // undo/redo가 실제로 바꾼 셀을 실행 시점의 일회성 observer로 수집한다 —
  // 스택 항목 내부 구조에 의존하지 않는 방법
  function runCollecting(run: () => void): CellAddress | null {
    let addr: CellAddress | null = null;
    const listener = (events: Y.YEvent<Y.Map<unknown>>[]) => {
      for (const event of events) {
        if (addr) return;
        if (event.target === cells) {
          const key = event.changes.keys.keys().next().value;
          if (key !== undefined) addr = parseCellKey(key);
        } else {
          addr = parseCellKey(String(event.path[0]));
        }
      }
    };
    cells.observeDeep(listener);
    try {
      run();
    } finally {
      cells.unobserveDeep(listener);
    }
    return addr;
  }

  function notify(addr: CellAddress | null) {
    for (const cb of revertedCbs) cb(addr);
  }

  const stackEvents = [
    "stack-item-added",
    "stack-item-popped",
    "stack-cleared",
  ] as const;

  return {
    undo() {
      if (manager.canUndo()) notify(runCollecting(() => manager.undo()));
    },
    redo() {
      if (manager.canRedo()) notify(runCollecting(() => manager.redo()));
    },
    canUndo: () => manager.canUndo(),
    canRedo: () => manager.canRedo(),
    subscribe(listener) {
      for (const event of stackEvents) manager.on(event, listener);
      return () => {
        for (const event of stackEvents) manager.off(event, listener);
      };
    },
    onReverted(cb) {
      revertedCbs.add(cb);
      return () => revertedCbs.delete(cb);
    },
    destroy() {
      revertedCbs.clear();
      manager.destroy();
    },
  };
}
