"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Tooltip } from "@/shared/ui/Tooltip";
import {
  CELL_ALIGNS,
  CELL_FONT_SIZES,
  CELL_FORMATS,
  DEFAULT_FONT_SIZE,
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
  "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[13px] text-ink-2 hover:bg-surface-3 hover:text-ink aria-pressed:bg-accent-soft aria-pressed:text-accent disabled:pointer-events-none disabled:opacity-40";

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

interface ToolbarViewProps {
  canUndo: boolean;
  canRedo: boolean;
  formats: Record<CellFormatName, boolean>;
  align: CellAlign;
  size: number;
  /** 세션 로드 전 자리 표시 — 모든 컨트롤을 비활성으로 그린다 */
  disabled?: boolean;
  onUndo?(): void;
  onRedo?(): void;
  onToggleFormat?(format: CellFormatName): void;
  onAlign?(align: CellAlign): void;
  onSize?(size: number): void;
  trailing?: ReactNode;
}

/** 툴바의 순수 표시 부분 — 상태는 props로만 받는다 (스켈레톤과 공유) */
function ToolbarView({
  canUndo,
  canRedo,
  formats,
  align: activeAlign,
  size,
  disabled = false,
  onUndo,
  onRedo,
  onToggleFormat,
  onAlign,
  onSize,
  trailing,
}: ToolbarViewProps) {
  return (
    <div
      className="border-line bg-surface flex h-11 shrink-0 items-center gap-0.5 border-b px-2.5"
      // 버튼 클릭이 그리드 input의 포커스를 뺏지 않게 한다 (클릭 동작은 유지됨)
      onMouseDown={(e) => e.preventDefault()}
    >
      <Tooltip label="실행 취소" shortcut="⌘Z">
        <button
          type="button"
          className={BUTTON}
          disabled={disabled || !canUndo}
          onClick={onUndo}
          aria-label="실행 취소"
        >
          <UndoIcon />
        </button>
      </Tooltip>
      <Tooltip label="다시 실행" shortcut="⌘⇧Z">
        <button
          type="button"
          className={BUTTON}
          disabled={disabled || !canRedo}
          onClick={onRedo}
          aria-label="다시 실행"
        >
          <UndoIcon flip />
        </button>
      </Tooltip>
      <ToolbarSeparator />
      <Tooltip label="글자 크기">
        <select
          className="text-ink hover:bg-surface-3 h-7 rounded-md bg-transparent px-1.5 text-[13px] tabular-nums focus:outline-none disabled:opacity-40"
          value={size}
          disabled={disabled}
          // 툴바의 mousedown preventDefault는 select를 못 열게 하므로 여기서 막는다 —
          // 선택 뒤 포커스는 셀 클릭으로 돌아온다
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => onSize?.(Number(e.target.value))}
          aria-label="글자 크기"
        >
          {CELL_FONT_SIZES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Tooltip>
      <ToolbarSeparator />
      {CELL_FORMATS.map((format) => {
        const { label, title, shortcut, className } = FORMAT_BUTTONS[format];
        return (
          <Tooltip key={format} label={title} shortcut={shortcut}>
            <button
              type="button"
              aria-pressed={formats[format]}
              className={`${BUTTON} ${className}`}
              disabled={disabled}
              onClick={() => onToggleFormat?.(format)}
              aria-label={title}
            >
              {label}
            </button>
          </Tooltip>
        );
      })}
      <ToolbarSeparator />
      {CELL_ALIGNS.map((align) => {
        const { title, path } = ALIGN_BUTTONS[align];
        return (
          <Tooltip key={align} label={title}>
            <button
              type="button"
              aria-pressed={activeAlign === align}
              className={BUTTON}
              disabled={disabled}
              onClick={() => onAlign?.(align)}
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
      {trailing && <div className="ml-auto flex items-center">{trailing}</div>}
    </div>
  );
}

const NO_FORMATS: Record<CellFormatName, boolean> = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
};

/** 시트 로드 전 자리 표시 — 레이아웃이 흔들리지 않도록 같은 모양을 비활성으로 그린다 */
export function SheetToolbarSkeleton({ trailing }: { trailing?: ReactNode }) {
  return (
    <ToolbarView
      canUndo={false}
      canRedo={false}
      formats={NO_FORMATS}
      align="left"
      size={DEFAULT_FONT_SIZE}
      disabled
      trailing={trailing}
    />
  );
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
  const activeStyle = useCellStyle(store, cursor.range.anchor);
  const activeValue = useSyncExternalStore(
    store.subscribe,
    () => store.getCellValue(cursor.range.anchor),
    () => "",
  );
  // 지정이 없으면 값 기준 자동 정렬이 눌린 상태로 보인다
  const autoAlign = defaultAlign(activeValue);

  return (
    <ToolbarView
      canUndo={canUndo}
      canRedo={canRedo}
      formats={activeFormats}
      align={activeStyle.align ?? autoAlign}
      size={activeStyle.size}
      onUndo={() => undo.undo()}
      onRedo={() => undo.redo()}
      onToggleFormat={(format) => store.toggleFormat(cursor.range, format)}
      // 자동 정렬과 같은 값을 고르면 지정을 지운다 — 값이 바뀌어도 자동으로 따라간다
      onAlign={(align) =>
        store.setCellAlign(cursor.range, align === autoAlign ? null : align)
      }
      onSize={(size) => store.setCellSize(cursor.range, size)}
      trailing={trailing}
    />
  );
}
