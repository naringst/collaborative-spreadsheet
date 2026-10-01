"use client";

import { useSyncExternalStore, type ReactNode } from "react";
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

const BUTTON =
  "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[13px] text-ink-2 hover:bg-surface-3 hover:text-ink disabled:pointer-events-none disabled:opacity-40";

function UndoIcon({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M6 4 3 7l3 3" />
      <path d="M3 7h6.5a3.5 3.5 0 0 1 0 7H8" />
    </svg>
  );
}

export function ToolbarSeparator() {
  return <div className="bg-line-2 mx-1.5 h-[18px] w-px" aria-hidden />;
}

interface SheetToolbarProps {
  store: SheetStore;
  undo: SheetUndo;
  /** 서식 적용 대상 범위와 눌린 상태 기준(활성 셀 = range.anchor) */
  cursor: GridCursor;
  /** 툴바 우측 끝에 놓을 요소(참여자·AI 버튼 등) — 툴바는 이들을 모른다 */
  trailing?: ReactNode;
}

/** undo·redo와 서식 버튼 (S4·S5) */
export function SheetToolbar({
  store,
  undo,
  cursor,
  trailing,
}: SheetToolbarProps) {
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

  return (
    <div
      className="border-line bg-surface flex h-11 shrink-0 items-center gap-0.5 border-b px-2.5"
      // 버튼 클릭이 그리드 input의 포커스를 뺏지 않게 한다 (클릭 동작은 유지됨)
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className={BUTTON}
        disabled={!canUndo}
        onClick={() => undo.undo()}
        title="실행 취소 (⌘Z)"
        aria-label="실행 취소"
      >
        <UndoIcon />
      </button>
      <button
        type="button"
        className={BUTTON}
        disabled={!canRedo}
        onClick={() => undo.redo()}
        title="다시 실행 (⌘⇧Z)"
        aria-label="다시 실행"
      >
        <UndoIcon flip />
      </button>
      <ToolbarSeparator />
      {CELL_FORMATS.map((format) => {
        const { label, title, className } = FORMAT_BUTTONS[format];
        return (
          <button
            key={format}
            type="button"
            aria-pressed={activeFormats[format]}
            className={`${BUTTON} ${className} ${
              activeFormats[format] ? "bg-accent-soft text-accent" : ""
            }`}
            onClick={() => store.toggleFormat(cursor.range, format)}
            title={title}
          >
            {label}
          </button>
        );
      })}
      {trailing && <div className="ml-auto flex items-center">{trailing}</div>}
    </div>
  );
}
