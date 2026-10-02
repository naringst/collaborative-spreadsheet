import { memo, useSyncExternalStore } from "react";
import { isNumericValue } from "../model/cell";
import { defaultAlign } from "../model/cell-format";
import { HEADER_H, HEADER_W } from "./metrics";
import { useCellFormats, useCellStyle } from "./hooks/useCellFormats";
import type { SheetStore } from "../store/sheet-store";

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
  // 밑줄과 취소선은 같은 속성(text-decoration-line)이라 함께 지정해야 둘 다 보인다
  const decoration = [
    formats.underline && "underline",
    formats.strike && "line-through",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      data-row={row}
      data-col={col}
      // sticky 헤더가 scrollIntoView 대상 셀을 가리지 않도록 헤더 치수만큼 보정
      style={{
        scrollMarginTop: HEADER_H,
        scrollMarginLeft: HEADER_W,
        textDecorationLine: decoration || undefined,
        textAlign: style.align ?? defaultAlign(value),
        fontSize: style.size,
      }}
      className={`border-line relative overflow-hidden border-r border-b px-1.5 leading-[25px] whitespace-nowrap ${
        isSelected && !isActive ? "bg-accent/7" : "bg-surface"
      } ${
        // 활성 셀: 링 + 우하단 채우기 핸들 (핸들은 장식 — 드래그 채우기는 명세 밖)
        isActive
          ? "after:border-surface after:bg-accent z-[1] shadow-[inset_0_0_0_2px_var(--color-accent)] after:absolute after:-right-px after:-bottom-px after:h-1.5 after:w-1.5 after:border after:content-['']"
          : ""
      } ${isNumericValue(value) ? "font-mono tabular-nums" : ""} ${formats.bold ? "font-semibold" : ""} ${formats.italic ? "italic" : ""}`}
    >
      {value}
    </div>
  );
});
