import { useSyncExternalStore } from "react";
import type { CellAddress } from "../../model/cell";
import {
  CELL_FORMAT,
  type CellAlign,
  type CellFormatName,
} from "../../model/cell-format";
import type { SheetStore } from "../../store/sheet-store";

function useFormat(
  store: SheetStore,
  addr: CellAddress,
  format: CellFormatName,
) {
  return useSyncExternalStore(
    store.subscribe,
    () => store.getCellFormat(addr, format),
    () => false,
  );
}

/** 셀 하나의 서식 상태. snapshot은 원시 boolean이라 캐시가 필요 없다. */
export function useCellFormats(store: SheetStore, addr: CellAddress) {
  // 고정된 4회 호출이라 훅 순서가 항상 같다
  return {
    bold: useFormat(store, addr, CELL_FORMAT.BOLD),
    italic: useFormat(store, addr, CELL_FORMAT.ITALIC),
    underline: useFormat(store, addr, CELL_FORMAT.UNDERLINE),
    strike: useFormat(store, addr, CELL_FORMAT.STRIKE),
  };
}

/** 셀 하나의 정렬·크기. 둘 다 원시값이라 캐시가 필요 없다. */
export function useCellStyle(
  store: SheetStore,
  addr: CellAddress,
): { align: CellAlign | null; size: number } {
  const align = useSyncExternalStore(
    store.subscribe,
    () => store.getCellAlign(addr),
    () => null,
  );
  const size = useSyncExternalStore(
    store.subscribe,
    () => store.getCellSize(addr),
    () => 13,
  );
  return { align, size };
}
