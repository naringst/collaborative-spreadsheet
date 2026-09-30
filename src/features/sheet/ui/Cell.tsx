import { memo, useSyncExternalStore } from "react";
import { isNumericValue } from "../model/cell";
import { HEADER_H, HEADER_W } from "./metrics";
import { useCellFormats } from "./useCellFormats";
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
      }}
      className={`overflow-hidden border-r border-b border-gray-200 px-1.5 py-0.5 text-sm whitespace-nowrap ${
        isSelected && !isActive ? "bg-blue-50" : "bg-white"
      } ${isActive ? "shadow-[inset_0_0_0_2px_theme(colors.blue.600)]" : ""} ${
        isNumericValue(value) ? "text-right" : "text-left"
      } ${formats.bold ? "font-bold" : ""} ${formats.italic ? "italic" : ""}`}
    >
      {value}
    </div>
  );
});
