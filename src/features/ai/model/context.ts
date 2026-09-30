import {
  cellLabel,
  rangeLabel,
  type CellFormatName,
  type CellSnapshot,
  type GridCursor,
} from "@/features/sheet";

/** LLM에 보낼 시트 컨텍스트 (D9). 셀은 A1 표기의 sparse 목록 */
export interface AiContext {
  cells: { cell: string; value: string; formats: CellFormatName[] }[];
  /** 선택 범위 "B2:D10" (단일 셀이면 "B2") — 활성 셀과 함께 항상 포함 (D9) */
  selection: string;
  activeCell: string;
}

export function buildContext(
  snapshot: CellSnapshot[],
  cursor: GridCursor,
): AiContext {
  return {
    cells: snapshot.map((c) => ({
      cell: cellLabel(c.addr),
      value: c.value,
      formats: c.formats,
    })),
    selection: rangeLabel(cursor.range),
    activeCell: cellLabel(cursor.range.anchor),
  };
}
