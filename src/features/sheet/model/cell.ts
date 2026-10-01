export const GRID_ROWS = 100;
export const GRID_COLS = 26;

export interface CellAddress {
  row: number;
  col: number;
}

export function cellKey(addr: CellAddress): string {
  return `${addr.row}:${addr.col}`;
}

export const CELL_FORMATS = ["bold", "italic", "underline", "strike"] as const;
export type CellFormatName = (typeof CELL_FORMATS)[number];

export function formatKey(addr: CellAddress, format: CellFormatName): string {
  return `${cellKey(addr)}:${format}`;
}

/** 값 서식(토글이 아닌 선택값): 정렬과 글자 크기 (S4·D3) */
export const CELL_ALIGNS = ["left", "center", "right"] as const;
export type CellAlign = (typeof CELL_ALIGNS)[number];
export const CELL_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24] as const;
export const DEFAULT_FONT_SIZE = 13;

export type CellStyleName = "align" | "size";

export function styleKey(addr: CellAddress, style: CellStyleName): string {
  return `${cellKey(addr)}:${style}`;
}

export function isCellAlign(v: unknown): v is CellAlign {
  return (
    typeof v === "string" && (CELL_ALIGNS as readonly string[]).includes(v)
  );
}

/** 정렬이 지정되지 않은 셀의 기본: 숫자는 오른쪽, 그 외 왼쪽 */
export function defaultAlign(value: string): CellAlign {
  return isNumericValue(value) ? "right" : "left";
}

export function parseCellKey(key: string): CellAddress | null {
  const [row, col] = key.split(":").map(Number);
  if (row === undefined || col === undefined) return null;
  // 그리드 밖·비정수 키는 손상된 것으로 보고 버린다 — 잘못된 라벨·주소 전파 방지
  if (!Number.isInteger(row) || row < 0 || row >= GRID_ROWS) return null;
  if (!Number.isInteger(col) || col < 0 || col >= GRID_COLS) return null;
  return { row, col };
}

export function columnLabel(col: number): string {
  return String.fromCharCode(65 + col);
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
