import { isNumericValue } from "./cell";

/** 토글 서식 (굵게·기울임·밑줄·취소선) (S4·D3) */
export const CELL_FORMATS = ["bold", "italic", "underline", "strike"] as const;
export type CellFormatName = (typeof CELL_FORMATS)[number];

/** 값 서식(토글이 아닌 선택값): 정렬과 글자 크기 (S4·D3) */
export const CELL_ALIGNS = ["left", "center", "right"] as const;
export type CellAlign = (typeof CELL_ALIGNS)[number];
export const CELL_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24] as const;
export const DEFAULT_FONT_SIZE = 13;

/** 값 서식의 종류 — 저장 키는 store/cell-keys의 styleKey가 만든다 */
export type CellStyleName = "align" | "size";

export function isCellAlign(v: unknown): v is CellAlign {
  return (
    typeof v === "string" && (CELL_ALIGNS as readonly string[]).includes(v)
  );
}

/** 정렬이 지정되지 않은 셀의 기본: 숫자는 오른쪽, 그 외 왼쪽 */
export function defaultAlign(value: string): CellAlign {
  return isNumericValue(value) ? "right" : "left";
}
