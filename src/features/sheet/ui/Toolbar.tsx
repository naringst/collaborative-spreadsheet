"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Tooltip } from "@/shared/ui/Tooltip";
import {
  CELL_ALIGNS,
  CELL_FONT_SIZES,
  CELL_FORMATS,
  defaultAlign,
  type CellAlign,
  type CellFormatName,
} from "../model/cell";
import type { SheetStore } from "../store/sheet-store";
import type { SheetUndo } from "../store/undo";
import type { GridCursor } from "./Grid";
import { useCellFormats, useCellStyle } from "./useCellFormats";

const FORMAT_BUTTONS: Record<
  CellFormatName,
  { label: string; title: string; shortcut: string; className: string }
> = {
  bold: { label: "B", title: "굵게", shortcut: "⌘B", className: "font-bold" },
  italic: { label: "I", title: "기울임", shortcut: "⌘I", className: "italic" },
  underline: {
    label: "U",
    title: "밑줄",
    shortcut: "⌘U",
    className: "underline",
  },
  strike: {
    label: "S",
    title: "취소선",
    shortcut: "⌘⇧X",
    className: "line-through",
  },
};

const ALIGN_BUTTONS: Record<CellAlign, { title: string; path: string }> = {
  left: { title: "왼쪽 정렬", path: "M2 4h12M2 8h8M2 12h12" },
  center: { title: "가운데 정렬", path: "M2 4h12M4 8h8M2 12h12" },
  right: { title: "오른쪽 정렬", path: "M2 4h12M6 8h8M2 12h12" },
};

const BUTTON =
  "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[13px] text-ink-2 hover:bg-surface hover:text-ink hover:shadow-[0_1px_2px_rgba(0,0,0,0.06)] aria-pressed:bg-surface aria-pressed:text-accent aria-pressed:shadow-[0_1px_2px_rgba(0,0,0,0.08)] disabled:pointer-events-none disabled:opacity-35";

/** 툴바 버튼 묶음 — 옅은 트레이 위에 올려 그룹 경계를 보여 준다 */
function Group({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface-2 flex items-center gap-0.5 rounded-lg p-0.5">
      {children}
    </div>
  );
}

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
  return <div className="bg-line-2 mx-1 h-[18px] w-px" aria-hidden />;
}

interface SheetToolbarProps {
  store: SheetStore;
  undo: SheetUndo;
  /** 서식 적용 대상 범위와 눌린 상태 기준(활성 셀 = range.anchor) */
  cursor: GridCursor;
  /** 툴바 왼쪽 끝에 놓을 요소(시트 제목 등) */
  leading?: ReactNode;
  /** 툴바 우측 끝에 놓을 요소(참여자·AI 버튼 등) — 툴바는 이들을 모른다 */
  trailing?: ReactNode;
}

/** undo·redo와 서식 버튼 (S4·S5) */
export function SheetToolbar({
  store,
  undo,
  cursor,
  leading,
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
  const activeStyle = useCellStyle(store, cursor.range.anchor);
  const activeValue = useSyncExternalStore(
    store.subscribe,
    () => store.getCellValue(cursor.range.anchor),
    () => "",
  );
  // 지정이 없으면 값 기준 자동 정렬이 눌린 상태로 보인다
  const activeAlign = activeStyle.align ?? defaultAlign(activeValue);

  return (
    <div
      className="border-line bg-surface flex h-12 shrink-0 items-center gap-1.5 border-b px-3"
      // 버튼 클릭이 그리드 input의 포커스를 뺏지 않게 한다 (클릭 동작은 유지됨)
      onMouseDown={(e) => e.preventDefault()}
    >
      {leading && (
        <div className="mr-2 flex min-w-0 items-center">{leading}</div>
      )}
      <Group>
        <Tooltip label="실행 취소" shortcut="⌘Z">
          <button
            type="button"
            className={BUTTON}
            disabled={!canUndo}
            onClick={() => undo.undo()}
            aria-label="실행 취소"
          >
            <UndoIcon />
          </button>
        </Tooltip>
        <Tooltip label="다시 실행" shortcut="⌘⇧Z">
          <button
            type="button"
            className={BUTTON}
            disabled={!canRedo}
            onClick={() => undo.redo()}
            aria-label="다시 실행"
          >
            <UndoIcon flip />
          </button>
        </Tooltip>
      </Group>
      <Group>
        <Tooltip label="글자 크기">
          <select
            className="text-ink-2 hover:bg-surface hover:text-ink h-7 rounded-md bg-transparent px-1.5 text-[12.5px] font-medium tabular-nums focus:outline-none"
            value={activeStyle.size}
            // 툴바의 mousedown preventDefault는 select를 못 열게 하므로 여기서 막는다 —
            // 선택 뒤 포커스는 셀 클릭으로 돌아온다
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) =>
              store.setCellSize(cursor.range, Number(e.target.value))
            }
            aria-label="글자 크기"
          >
            {CELL_FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </Tooltip>
      </Group>
      <Group>
        {CELL_FORMATS.map((format) => {
          const { label, title, shortcut, className } = FORMAT_BUTTONS[format];
          return (
            <Tooltip key={format} label={title} shortcut={shortcut}>
              <button
                type="button"
                aria-pressed={activeFormats[format]}
                className={`${BUTTON} ${className}`}
                onClick={() => store.toggleFormat(cursor.range, format)}
                aria-label={title}
              >
                {label}
              </button>
            </Tooltip>
          );
        })}
      </Group>
      <Group>
        {CELL_ALIGNS.map((align) => {
          const { title, path } = ALIGN_BUTTONS[align];
          const pressed = activeAlign === align;
          return (
            <Tooltip key={align} label={title}>
              <button
                type="button"
                aria-pressed={pressed}
                className={BUTTON}
                // 자동 정렬과 같은 값을 고르면 지정을 지운다 — 값이 바뀌어도 자동으로 따라간다
                onClick={() =>
                  store.setCellAlign(
                    cursor.range,
                    align === defaultAlign(activeValue) ? null : align,
                  )
                }
                aria-label={title}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d={path} />
                </svg>
              </button>
            </Tooltip>
          );
        })}
      </Group>
      {trailing && <div className="ml-auto flex items-center">{trailing}</div>}
    </div>
  );
}
