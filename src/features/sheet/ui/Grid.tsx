"use client";

import {
  memo,
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
import { cellRect } from "./layout/metrics";
import {
  COL_HEADER_CLASS,
  CORNER_HEADER_CLASS,
  GRID_CONTAINER_CLASS,
  GRID_CONTAINER_STYLE,
  ROW_HEADER_CLASS,
} from "./layout/grid-layout";
import { useDragSelection } from "./hooks/useDragSelection";
import { useEditing } from "./hooks/useEditing";
import { useGridKeyboard } from "./hooks/useGridKeyboard";
import { useSelection } from "./hooks/useSelection";

const ROWS = Array.from({ length: GRID_ROWS }, (_, i) => i);
const COLS = Array.from({ length: GRID_COLS }, (_, i) => i);

/** 헤더 클릭 대상: 열 헤더·행 헤더·모서리(전체) */
type HeaderHit =
  { kind: "col"; col: number } | { kind: "row"; row: number } | { kind: "all" };

function headerFromEventTarget(target: EventTarget): HeaderHit | null {
  const el = (target as HTMLElement).closest?.("[data-header]");
  if (!(el instanceof HTMLElement)) return null;
  const kind = el.dataset.header;
  if (kind === "col") return { kind, col: Number(el.dataset.col) };
  if (kind === "row") return { kind, row: Number(el.dataset.row) };
  if (kind === "all") return { kind };
  return null;
}

function addrFromEventTarget(target: EventTarget): CellAddress | null {
  // 행 헤더도 data-row를 가지므로 둘 다 있는 셀만 찾는다
  const el = (target as HTMLElement).closest?.("[data-row][data-col]");
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

// memo: 커서 미러 등 부모 리렌더에서 props가 같으면 2,700개 셀 트리를 다시 만들지 않는다
export const SheetGrid = memo(function SheetGrid({
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

  const { range, active, selectCell, selectRange, extendTo } = selection;
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

  // 헤더 클릭·드래그 = 행·열 전체 선택 (S1 P2). anchor(활성 셀)는 그 행·열의 첫 셀,
  // focus는 끝 셀. Shift+클릭은 기존 anchor를 두고 끝만 옮긴다
  const onHeaderPointerDown = (e: PointerEvent, hit: HeaderHit) => {
    e.preventDefault();
    inputRef.current?.focus({ preventScroll: true });
    if (editing) commit();
    const last = { row: GRID_ROWS - 1, col: GRID_COLS - 1 };
    if (hit.kind === "all") {
      selectRange({ anchor: { row: 0, col: 0 }, focus: last });
      return;
    }
    const first =
      hit.kind === "col" ? { row: 0, col: hit.col } : { row: hit.row, col: 0 };
    const end =
      hit.kind === "col"
        ? { row: last.row, col: hit.col }
        : { row: hit.row, col: last.col };
    if (e.shiftKey) extendTo(end);
    else selectRange({ anchor: first, focus: end });
    drag.begin(e, hit.kind);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const header = headerFromEventTarget(e.target);
    if (header) {
      onHeaderPointerDown(e, header);
      return;
    }
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
      className="bg-surface text-ink relative h-full overflow-auto"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={drag.move}
      onPointerUp={drag.stop}
      onPointerCancel={drag.stop}
      onDoubleClick={onDoubleClick}
    >
      <div className={GRID_CONTAINER_CLASS} style={GRID_CONTAINER_STYLE}>
        <div
          data-header="all"
          title="전체 선택"
          className={`${CORNER_HEADER_CLASS} cursor-pointer`}
        />
        {COLS.map((col) => (
          <div
            key={col}
            data-header="col"
            data-col={col}
            className={`${COL_HEADER_CLASS} cursor-pointer ${
              col >= norm.left && col <= norm.right
                ? "bg-accent-soft text-accent"
                : "bg-grid-head text-ink-2"
            }`}
          >
            {columnLabel(col)}
          </div>
        ))}
        {ROWS.map((row) => (
          <div key={row} className="contents">
            <div
              data-header="row"
              data-row={row}
              className={`${ROW_HEADER_CLASS} cursor-pointer ${
                row >= norm.top && row <= norm.bottom
                  ? "bg-accent-soft text-accent"
                  : "bg-grid-head text-ink-2"
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
          className="border-accent pointer-events-none absolute z-[5] border"
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
});
