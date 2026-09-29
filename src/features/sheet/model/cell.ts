export const GRID_ROWS = 100;
export const GRID_COLS = 26;

export interface CellAddress {
  row: number;
  col: number;
}

export function cellKey(addr: CellAddress): string {
  return `${addr.row}:${addr.col}`;
}

export function columnLabel(col: number): string {
  return String.fromCharCode(65 + col);
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
