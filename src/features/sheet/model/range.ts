import type { CellAddress } from "./cell";

/** anchor는 범위의 시작(활성 셀), focus는 드래그·Shift 확장의 끝. 뒤집힌 방향도 허용된다. */
export interface CellRange {
  anchor: CellAddress;
  focus: CellAddress;
}

export interface NormalizedRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export function normalizeRange(range: CellRange): NormalizedRange {
  return {
    top: Math.min(range.anchor.row, range.focus.row),
    bottom: Math.max(range.anchor.row, range.focus.row),
    left: Math.min(range.anchor.col, range.focus.col),
    right: Math.max(range.anchor.col, range.focus.col),
  };
}

export function rangeContains(range: CellRange, addr: CellAddress): boolean {
  const { top, left, bottom, right } = normalizeRange(range);
  return (
    addr.row >= top &&
    addr.row <= bottom &&
    addr.col >= left &&
    addr.col <= right
  );
}

export function cellsInRange(range: CellRange): CellAddress[] {
  const { top, left, bottom, right } = normalizeRange(range);
  const cells: CellAddress[] = [];
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      cells.push({ row, col });
    }
  }
  return cells;
}
