"use client";

import { useSyncExternalStore } from "react";
import { CELL_FORMATS, type CellFormatName } from "../model/cell";
import type { SheetStore } from "../store/sheet-store";
import type { SheetUndo } from "../store/undo";
import type { GridCursor } from "./Grid";
import { useCellFormats } from "./useCellFormats";

const FORMAT_BUTTONS: Record<
  CellFormatName,
  { label: string; title: string; className: string }
> = {
  bold: { label: "B", title: "굵게 (⌘B)", className: "font-bold" },
  italic: { label: "I", title: "기울임 (⌘I)", className: "italic" },
  underline: { label: "U", title: "밑줄 (⌘U)", className: "underline" },
  strike: { label: "S", title: "취소선 (⌘⇧X)", className: "line-through" },
};

interface SheetToolbarProps {
  store: SheetStore;
  undo: SheetUndo;
  /** 서식 적용 대상 범위와 눌린 상태 기준(활성 셀 = range.anchor) */
  cursor: GridCursor;
}

/** undo·redo와 서식 버튼 (S4·S5) */
export function SheetToolbar({ store, undo, cursor }: SheetToolbarProps) {
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
  const activeFormats = useCellFormats(store, cursor.range.anchor);

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
      <div className="mx-1 h-4 w-px bg-gray-300" />
      {CELL_FORMATS.map((format) => {
        const { label, title, className } = FORMAT_BUTTONS[format];
        return (
          <button
            key={format}
            type="button"
            aria-pressed={activeFormats[format]}
            className={`${buttonClass} ${className} ${
              activeFormats[format] ? "border-blue-500 bg-blue-100" : ""
            }`}
            onClick={() => store.toggleFormat(cursor.range, format)}
            title={title}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
