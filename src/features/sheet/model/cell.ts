export const GRID_ROWS = 100;
export const GRID_COLS = 26;

export interface CellAddress {
  row: number;
  col: number;
}

export function cellKey(addr: CellAddress): string {
  return `${addr.row}:${addr.col}`;
}

const COLUMN_A = "A".charCodeAt(0);

export function columnLabel(col: number): string {
  return String.fromCharCode(COLUMN_A + col);
}

/** 셀 주소를 A1 표기로 (AI 컨텍스트·범위 칩) */
export function cellLabel(addr: CellAddress): string {
  return `${columnLabel(addr.col)}${addr.row + 1}`;
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

export function moveWithinGrid(
  addr: CellAddress,
  dRow: number,
  dCol: number,
): CellAddress {
  return {
    row: clamp(addr.row + dRow, GRID_ROWS - 1),
    col: clamp(addr.col + dCol, GRID_COLS - 1),
  };
}

export function isSameCell(a: CellAddress, b: CellAddress): boolean {
  return a.row === b.row && a.col === b.col;
}

export function isNumericValue(value: string): boolean {
  return value.trim() !== "" && !Number.isNaN(Number(value));
}
