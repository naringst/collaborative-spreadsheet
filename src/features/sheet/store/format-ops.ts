import type { CellAddress } from "../model/cell";
import {
  CELL_STYLE,
  DEFAULT_FONT_SIZE,
  isCellAlign,
  type CellAlign,
  type CellFormatName,
} from "../model/cell-format";
import { cellsInRange, type CellRange } from "../model/range";
import { formatKey, styleKey, type CellsMap } from "./cell-keys";

export function createFormatOps(
  cells: CellsMap,
  transactLocal: (fn: () => void) => void,
) {
  // 범위의 각 셀에 edit을 적용하는 공통 뼈대 (서식·정렬·크기가 공유)
  function editRange(range: CellRange, edit: (addr: CellAddress) => void) {
    transactLocal(() => {
      for (const addr of cellsInRange(range)) edit(addr);
    });
  }

  function getCellFormat(addr: CellAddress, format: CellFormatName): boolean {
    return cells.get(formatKey(addr, format)) === true;
  }

  function getCellAlign(addr: CellAddress): CellAlign | null {
    const v = cells.get(styleKey(addr, CELL_STYLE.ALIGN));
    return isCellAlign(v) ? v : null;
  }

  function getCellSize(addr: CellAddress): number {
    const v = cells.get(styleKey(addr, CELL_STYLE.SIZE));
    return typeof v === "number" ? v : DEFAULT_FONT_SIZE;
  }

  return {
    getCellFormat,
    getCellAlign,
    getCellSize,

    toggleFormat(range: CellRange, format: CellFormatName) {
      const allOn = cellsInRange(range).every((addr) =>
        getCellFormat(addr, format),
      );
      // 이미 맞는 상태의 셀은 건드리지 않는다 — undo가 정확히 원래 상태로 복구된다
      editRange(range, (addr) => {
        const key = formatKey(addr, format);
        if (allOn) cells.delete(key);
        else if (!getCellFormat(addr, format)) cells.set(key, true);
      });
    },

    setCellAlign(range: CellRange, align: CellAlign | null) {
      // 이미 같은 값인 셀은 건드리지 않는다 — undo가 정확히 원래 상태로 복구된다
      editRange(range, (addr) => {
        if (getCellAlign(addr) === align) return;
        const key = styleKey(addr, CELL_STYLE.ALIGN);
        if (align === null) cells.delete(key);
        else cells.set(key, align);
      });
    },

    setCellSize(range: CellRange, size: number) {
      editRange(range, (addr) => {
        if (getCellSize(addr) === size) return;
        const key = styleKey(addr, CELL_STYLE.SIZE);
        if (size === DEFAULT_FONT_SIZE) cells.delete(key);
        else cells.set(key, size);
      });
    },
  };
}
