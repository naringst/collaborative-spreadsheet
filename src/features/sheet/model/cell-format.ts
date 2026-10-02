import { isNumericValue } from "./cell";

/**
 * 서식·정렬·스타일 이름을 상수로 참조해 매직 스트링을 없앤다 (예: CELL_FORMAT.BOLD).
 * 이름 목록(배열)과 union 타입은 이 객체들에서 파생한다 — 정의가 한 곳에만 있다.
 */

/** 토글 서식 (굵게·기울임·밑줄·취소선) (S4·D3) */
export const CELL_FORMAT = {
  BOLD: "bold",
  ITALIC: "italic",
  UNDERLINE: "underline",
  STRIKE: "strike",
} as const;
export const CELL_FORMATS = Object.values(CELL_FORMAT);
export type CellFormatName = (typeof CELL_FORMAT)[keyof typeof CELL_FORMAT];

/** 값 서식(토글이 아닌 선택값): 정렬 */
export const CELL_ALIGN = {
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
} as const;
export const CELL_ALIGNS = Object.values(CELL_ALIGN);
export type CellAlign = (typeof CELL_ALIGN)[keyof typeof CELL_ALIGN];

export const CELL_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24] as const;
export const DEFAULT_FONT_SIZE = 13;

/** 값 서식의 종류 — 저장 키는 store/cell-keys의 styleKey가 만든다 */
export const CELL_STYLE = { ALIGN: "align", SIZE: "size" } as const;
export type CellStyleName = (typeof CELL_STYLE)[keyof typeof CELL_STYLE];

export function isCellAlign(v: unknown): v is CellAlign {
  return (
    typeof v === "string" && (CELL_ALIGNS as readonly string[]).includes(v)
  );
}

/** 정렬이 지정되지 않은 셀의 기본: 숫자는 오른쪽, 그 외 왼쪽 */
export function defaultAlign(value: string): CellAlign {
  return isNumericValue(value) ? CELL_ALIGN.RIGHT : CELL_ALIGN.LEFT;
}
