import type { CellAddress } from "../model/cell";
import { CELL_FORMATS, type CellFormatName } from "../model/cell-format";
import { cellsInRange, type CellRange } from "../model/range";
import { parseCellKey, valueKey, type CellsMap } from "./cell-keys";

export interface CellSnapshot {
  addr: CellAddress;
  value: string;
  formats: CellFormatName[];
}

export function createValueOps(
  cells: CellsMap,
  transactLocal: (fn: () => void) => void,
  getCellFormat: (addr: CellAddress, format: CellFormatName) => boolean,
) {
  function getCellValue(addr: CellAddress): string {
    const v = cells.get(valueKey(addr));
    return typeof v === "string" ? v : "";
  }

  function setValue(addr: CellAddress, value: string) {
    // 값이 같으면 쓰지 않는다 — 무변경 커밋(Enter만 누름)이 undo 단계를 만들지 않게
    if (getCellValue(addr) === value) return;
    if (value === "") {
      // 빈 값은 키를 지워 "값 없음"과 "빈 문자열"이 갈라지지 않게 한다.
      cells.delete(valueKey(addr));
      return;
    }
    cells.set(valueKey(addr), value);
  }

  return {
    getCellValue,

    setCellValue(addr: CellAddress, value: string) {
      transactLocal(() => setValue(addr, value));
    },

    clearRange(range: CellRange) {
      transactLocal(() => {
        for (const addr of cellsInRange(range)) setValue(addr, "");
      });
    },

    applyCellValues(changes: { addr: CellAddress; value: string }[]) {
      transactLocal(() => {
        for (const { addr, value } of changes) setValue(addr, value);
      });
    },

    snapshotValues(): CellSnapshot[] {
      const result: CellSnapshot[] = [];
      for (const key of cells.keys()) {
        // 값 있는 셀의 기준은 "r:c:v" 키의 존재다
        if (!key.endsWith(":v")) continue;
        const addr = parseCellKey(key);
        if (!addr) continue;
        result.push({
          addr,
          value: getCellValue(addr),
          formats: CELL_FORMATS.filter((f) => getCellFormat(addr, f)),
        });
      }
      return result;
    },
  };
}
