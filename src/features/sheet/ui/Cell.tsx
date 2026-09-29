import { memo } from "react";
import { useSyncExternalStore } from "react";
import { isNumericValue } from "../model/cell";
import { HEADER_H, HEADER_W } from "./metrics";
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

  return (
    <div
      data-row={row}
      data-col={col}
      // sticky 헤더가 scrollIntoView 대상 셀을 가리지 않도록 헤더 치수만큼 보정
      style={{ scrollMarginTop: HEADER_H, scrollMarginLeft: HEADER_W }}
      className={`overflow-hidden border-b border-r border-gray-200 px-1.5 py-0.5 text-sm whitespace-nowrap ${
        isSelected && !isActive ? "bg-blue-50" : "bg-white"
      } ${isActive ? "shadow-[inset_0_0_0_2px_theme(colors.blue.600)]" : ""} ${
        isNumericValue(value) ? "text-right" : "text-left"
      }`}
    >
      {value}
    </div>
  );
});
