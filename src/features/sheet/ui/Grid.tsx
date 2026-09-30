"use client";

import {
  useEffect,
  useRef,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  GRID_COLS,
  GRID_ROWS,
  columnLabel,
  isSameCell,
  type CellAddress,
} from "../model/cell";
import { normalizeRange, rangeContains, type CellRange } from "../model/range";
import type { SheetStore } from "../store/sheet-store";
import type { SheetUndo } from "../store/undo";
import { Cell } from "./Cell";
import { CellEditor } from "./CellEditor";
import { CELL_H, CELL_W, HEADER_W, cellRect } from "./metrics";
import { useDragSelection } from "./useDragSelection";
import { useEditing } from "./useEditing";
import { useGridKeyboard } from "./useGridKeyboard";
import { useSelection } from "./useSelection";

const ROWS = Array.from({ length: GRID_ROWS }, (_, i) => i);
const COLS = Array.from({ length: GRID_COLS }, (_, i) => i);

function addrFromEventTarget(target: EventTarget): CellAddress | null {
  const el = (target as HTMLElement).closest?.("[data-row]");
  if (!(el instanceof HTMLElement)) return null;
  return { row: Number(el.dataset.row), col: Number(el.dataset.col) };
}

export interface GridCursor {
  range: CellRange;
  editing: CellAddress | null;
}

interface SheetGridProps {
  store: SheetStore;
  undo?: SheetUndo;
  /** 다른 feature(collab 등)가 그리드 위에 끼우는 레이어 — Grid는 이들을 모른다 */
  overlay?: ReactNode;
  /** 내 선택·편집 위치가 바뀔 때 호출 — awareness 복사용 (원본은 React state) */
  onPresenceChange?: (cursor: GridCursor) => void;
}

export function SheetGrid({
  store,
  undo,
  overlay,
  onPresenceChange,
}: SheetGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  const selection = useSelection();
  const editingApi = useEditing(store, inputRef);
  const onKeyDown = useGridKeyboard(store, selection, editingApi, undo);

  const { range, active, selectCell, extendTo } = selection;
  const { editing, remoteConflict, start, commit } = editingApi;
  const drag = useDragSelection(containerRef, extendTo);

  // 내 선택·편집 위치를 awareness로 복사한다 (C5). 입력 중 텍스트는 보내지 않는다 (C2)
  useEffect(() => {
    onPresenceChange?.({ range, editing: editing?.addr ?? null });
  }, [onPresenceChange, range, editing]);

  // undo/redo가 되돌린 셀로 선택을 옮긴다 (S5 P1)
  useEffect(() => {
    if (!undo) return;
    return undo.onReverted((addr) => {
      if (addr) selectCell(addr);
    });
  }, [undo, selectCell]);

  // 키보드 입력(문자·조합 포함)이 항상 CellEditor의 input으로 들어가게 한다
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  // 활성 셀이 화면 밖이면 보이도록 스크롤 (S3). sticky 헤더는 scroll-margin으로 보정
  useEffect(() => {
    containerRef.current
      ?.querySelector(`[data-row="${active.row}"][data-col="${active.col}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    // 셀 밖(스크롤바 등)은 건드리지 않는다 — pointerdown preventDefault는
    // 네이티브 스크롤바 드래그까지 막는다
    const addr = addrFromEventTarget(e.target);
    if (!addr) return;

    // input의 포커스를 뺏지 않는다 — 포커스가 떠나면 IME 조합·키 입력이 끊긴다.
    // 다른 요소(툴바 등)에 포커스가 가 있던 경우도 셀 클릭으로 되찾는다.
    e.preventDefault();
    inputRef.current?.focus({ preventScroll: true });

    if (editing) {
      if (isSameCell(editing.addr, addr)) return; // 편집 중 자신 클릭은 유지
      if (composingRef.current) {
        // blur가 진행 중인 IME 조합을 확정시켜 input.value에 반영한다 —
        // 조합 중간 상태로 커밋되거나 잔여 글자가 되살아나는 것을 막는다
        inputRef.current?.blur();
        inputRef.current?.focus({ preventScroll: true });
        composingRef.current = false;
      }
      commit(); // 다른 셀 클릭 = 확정 (S2)
    }
    if (e.shiftKey) extendTo(addr);
    else selectCell(addr);

    drag.begin(e);
  };

  const onDoubleClick = (e: MouseEvent) => {
    const addr = addrFromEventTarget(e.target);
    if (addr && !editing) start(addr, "append");
  };

  const norm = normalizeRange(range);
  const isSingleCell = norm.top === norm.bottom && norm.left === norm.right;

  return (
    <div
      ref={containerRef}
      // 시트는 라이트 팔레트 고정(셀 bg-white) — OS 다크 모드의 밝은 전역 글자색이
      // 흰 셀 위에 얹히지 않도록 검정으로 못박는다
      className="relative h-full overflow-auto text-gray-900"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={drag.move}
      onPointerUp={drag.stop}
      onPointerCancel={drag.stop}
      onDoubleClick={onDoubleClick}
    >
      <div
        className="grid w-max select-none"
        style={{
          gridTemplateColumns: `${HEADER_W}px repeat(${GRID_COLS}, ${CELL_W}px)`,
          gridAutoRows: `${CELL_H}px`,
        }}
      >
        <div className="sticky top-0 left-0 z-30 border-r border-b border-gray-300 bg-gray-100" />
        {COLS.map((col) => (
          <div
            key={col}
            className={`sticky top-0 z-20 border-r border-b border-gray-300 text-center text-xs leading-7 ${
              col >= norm.left && col <= norm.right
                ? "bg-blue-100"
                : "bg-gray-50"
            }`}
          >
            {columnLabel(col)}
          </div>
        ))}
        {ROWS.map((row) => (
          <div key={row} className="contents">
            <div
              className={`sticky left-0 z-10 border-r border-b border-gray-300 text-center text-xs leading-7 ${
                row >= norm.top && row <= norm.bottom
                  ? "bg-blue-100"
                  : "bg-gray-50"
              }`}
            >
              {row + 1}
            </div>
            {COLS.map((col) => (
              <Cell
                key={col}
                store={store}
                row={row}
                col={col}
                isActive={isSameCell(active, { row, col })}
                isSelected={rangeContains(range, { row, col })}
              />
            ))}
          </div>
        ))}
      </div>

      {!isSingleCell && (
        <div
          className="pointer-events-none absolute z-[5] border border-blue-500"
          style={cellRect(norm.top, norm.left, norm.bottom, norm.right)}
        />
      )}

      {overlay}

      <CellEditor
        inputRef={inputRef}
        composingRef={composingRef}
        active={active}
        editing={editing}
        remoteConflict={remoteConflict}
        start={start}
      />
    </div>
  );
}
