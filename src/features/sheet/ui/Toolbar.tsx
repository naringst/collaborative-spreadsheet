"use client";

import { useSyncExternalStore } from "react";
import type { SheetUndo } from "../store/undo";

/** undo·redo 버튼. S4 서식 버튼이 다음 묶음에서 여기에 추가된다. */
export function SheetToolbar({ undo }: { undo: SheetUndo }) {
  const canUndo = useSyncExternalStore(
    undo.subscribe,
    undo.canUndo,
    () => false,
  );
  const canRedo = useSyncExternalStore(
    undo.subscribe,
    undo.canRedo,
    () => false,
  );

  const buttonClass =
    "rounded border border-gray-300 px-2 py-0.5 text-sm disabled:opacity-40";

  return (
    <div
      className="flex items-center gap-1 border-b border-gray-200 px-2 py-1"
      // 버튼 클릭이 그리드 input의 포커스를 뺏지 않게 한다 (클릭 동작은 유지됨)
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className={buttonClass}
        disabled={!canUndo}
        onClick={() => undo.undo()}
        title="실행 취소 (⌘Z)"
      >
        ↩︎
      </button>
      <button
        type="button"
        className={buttonClass}
        disabled={!canRedo}
        onClick={() => undo.redo()}
        title="다시 실행 (⌘⇧Z)"
      >
        ↪︎
      </button>
    </div>
  );
}
