"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent,
  type PointerEvent,
} from "react";
import {
  GRID_COLS,
  GRID_ROWS,
  columnLabel,
  isSameCell,
  moveWithinGrid,
  type CellAddress,
} from "../model/cell";
import { normalizeRange, rangeContains } from "../model/range";
import type { SheetStore } from "../store/sheet-store";
import { Cell } from "./Cell";
import { CellEditor } from "./CellEditor";
import { CELL_H, CELL_W, HEADER_H, HEADER_W, cellRect } from "./metrics";
import { useEditing } from "./useEditing";
import { useGridKeyboard } from "./useGridKeyboard";
import { useSelection } from "./useSelection";

const ROWS = Array.from({ length: GRID_ROWS }, (_, i) => i);
const COLS = Array.from({ length: GRID_COLS }, (_, i) => i);

/** 드래그 자동 스크롤: 가장자리 이 거리 안이면 프레임당 이 픽셀만큼 스크롤 */
const EDGE = 24;
const SCROLL_STEP = 16;

function addrFromEventTarget(target: EventTarget): CellAddress | null {
  const el = (target as HTMLElement).closest?.("[data-row]");
  if (!(el instanceof HTMLElement)) return null;
  return { row: Number(el.dataset.row), col: Number(el.dataset.col) };
}

export function SheetGrid({ store }: { store: SheetStore }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const dragPointer = useRef<{ x: number; y: number } | null>(null);
  const rafId = useRef<number | null>(null);

  const selection = useSelection();
  const editingApi = useEditing(store, inputRef);
  const onKeyDown = useGridKeyboard(store, selection, editingApi);

  const { range, active, selectCell, extendTo } = selection;
  const { editing, start, commit } = editingApi;

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

  // 포인터 좌표 → 셀 주소. 헤더·콘텐츠 밖 좌표는 가장 가까운 셀로 클램프되어
  // 창 밖 드래그에서도 마지막 행·열까지 확장된다
  const addrFromPointer = useCallback((x: number, y: number): CellAddress | null => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    return moveWithinGrid(
      {
        row: Math.floor((y - rect.top + container.scrollTop - HEADER_H) / CELL_H),
        col: Math.floor((x - rect.left + container.scrollLeft - HEADER_W) / CELL_W),
      },
      0,
      0,
    );
  }, []);

  const stopDrag = useCallback(() => {
    dragPointer.current = null;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, []);

  // 드래그 중 언마운트되면 rAF 루프를 정리한다
  useEffect(() => stopDrag, [stopDrag]);

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    // input의 포커스를 뺏지 않는다 — 포커스가 떠나면 IME 조합·키 입력이 끊긴다.
    // 다른 요소(툴바 등)에 포커스가 가 있던 경우도 셀 클릭으로 되찾는다.
    e.preventDefault();
    inputRef.current?.focus({ preventScroll: true });

    const addr = addrFromEventTarget(e.target);
    if (!addr) return;

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

    // 포인터 캡처: 창 밖으로 나가도 move·up이 계속 들어와 드래그가 고아가 되지 않는다
    containerRef.current?.setPointerCapture(e.pointerId);
    dragPointer.current = { x: e.clientX, y: e.clientY };

    // 가장자리 자동 스크롤 (S1 P1). rafId 가드로 루프는 하나만 돈다
    const step = () => {
      rafId.current = null;
      const pointer = dragPointer.current;
      const container = containerRef.current;
      if (!pointer || !container) return;
      const rect = container.getBoundingClientRect();
      let dx = 0;
      let dy = 0;
      if (pointer.x < rect.left + HEADER_W + EDGE) dx = -SCROLL_STEP;
      else if (pointer.x > rect.right - EDGE) dx = SCROLL_STEP;
      if (pointer.y < rect.top + HEADER_H + EDGE) dy = -SCROLL_STEP;
      else if (pointer.y > rect.bottom - EDGE) dy = SCROLL_STEP;
      if (dx || dy) {
        container.scrollBy(dx, dy);
        const next = addrFromPointer(pointer.x, pointer.y);
        if (next) extendTo(next);
      }
      rafId.current = requestAnimationFrame(step);
    };
    if (rafId.current === null) rafId.current = requestAnimationFrame(step);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragPointer.current) return;
    if (e.buttons === 0) {
      // 창 밖 등에서 버튼이 이미 놓인 경우의 안전망
      stopDrag();
      return;
    }
    dragPointer.current = { x: e.clientX, y: e.clientY };
    const addr = addrFromPointer(e.clientX, e.clientY);
    if (addr) extendTo(addr);
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
      className="relative h-full overflow-auto"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
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
              col >= norm.left && col <= norm.right ? "bg-blue-100" : "bg-gray-50"
            }`}
          >
            {columnLabel(col)}
          </div>
        ))}
        {ROWS.map((row) => (
          <div key={row} className="contents">
            <div
              className={`sticky left-0 z-10 border-r border-b border-gray-300 text-center text-xs leading-7 ${
                row >= norm.top && row <= norm.bottom ? "bg-blue-100" : "bg-gray-50"
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

      <CellEditor
        inputRef={inputRef}
        composingRef={composingRef}
        active={active}
        editing={editing}
        start={start}
      />
    </div>
  );
}
