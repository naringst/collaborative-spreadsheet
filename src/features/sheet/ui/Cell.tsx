import { memo, useSyncExternalStore } from "react";
import { isNumericValue } from "../model/cell";
import { defaultAlign } from "../model/cell-format";
import { HEADER_H, HEADER_W } from "./metrics";
import { useCellFormats, useCellStyle } from "./hooks/useCellFormats";
import type { SheetStore } from "../store/sheet-store";

const CELL_BASE =
  "border-line relative overflow-hidden border-r border-b px-1.5 leading-[25px] whitespace-nowrap";

// 선택 범위 안(활성 셀 제외): 옅은 강조 배경
const CELL_SELECTED = "bg-accent/7";

// 활성 셀: 링 + 우하단 채우기 핸들(after) (핸들은 장식 — 드래그 채우기는 명세 밖)
const CELL_ACTIVE =
  "z-[1] shadow-[inset_0_0_0_2px_var(--color-accent)] " +
  "after:absolute after:-right-px after:-bottom-px after:h-1.5 after:w-1.5 " +
  "after:border after:border-surface after:bg-accent after:content-['']";

/**
 * 밑줄·취소선은 Tailwind 클래스로 합성할 수 없다 — underline과 line-through가
 * 같은 속성(text-decoration-line)이라 클래스 둘을 달면 한쪽만 적용된다.
 * "underline line-through"처럼 한 값으로 합쳐 inline style로 지정한다.
 */
function textDecorationLine(formats: {
  underline: boolean;
  strike: boolean;
}): string | undefined {
  const parts = [
    formats.underline && "underline",
    formats.strike && "line-through",
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

interface CellProps {
  store: SheetStore;
  row: number;
  col: number;
  isActive: boolean;
  isSelected: boolean;
}

export const Cell = memo(function Cell({
  store,
  row,
  col,
  isActive,
  isSelected,
}: CellProps) {
  const value = useSyncExternalStore(
    store.subscribe,
    () => store.getCellValue({ row, col }),
    () => "",
  );
  const formats = useCellFormats(store, { row, col });
  const style = useCellStyle(store, { row, col });

  return (
    <div
      data-row={row}
      data-col={col}
      // sticky 헤더가 scrollIntoView 대상 셀을 가리지 않도록 헤더 치수만큼 보정
      style={{
        scrollMarginTop: HEADER_H,
        scrollMarginLeft: HEADER_W,
        textDecorationLine: textDecorationLine(formats),
        textAlign: style.align ?? defaultAlign(value),
        fontSize: style.size,
      }}
      className={[
        CELL_BASE,
        isSelected && !isActive ? CELL_SELECTED : "bg-surface",
        isActive && CELL_ACTIVE,
        isNumericValue(value) && "font-mono tabular-nums",
        formats.bold && "font-semibold",
        formats.italic && "italic",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {value}
    </div>
  );
});
