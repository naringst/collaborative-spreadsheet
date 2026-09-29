import * as Y from "yjs";
import { cellKey, type CellAddress } from "../model/cell";
import { cellsInRange, type CellRange } from "../model/range";

/** UndoManager trackedOrigins 대상. 로컬 편집은 반드시 이 origin의 transact로 실행한다. */
export const LOCAL_ORIGIN = Symbol("local");

export interface SheetStore {
  setCellValue(addr: CellAddress, value: string): void;
  clearRange(range: CellRange): void;
  getCellValue(addr: CellAddress): string;
  subscribe(listener: () => void): () => void;
}

type CellMap = Y.Map<string>;

export function createSheetStore(doc: Y.Doc): SheetStore {
  const cells = doc.getMap<CellMap>("cells");

  function setValue(addr: CellAddress, value: string) {
    const key = cellKey(addr);
    if (value === "") {
      // 빈 값은 키를 지워 "값 없음"과 "빈 문자열"이 갈라지지 않게 한다.
      cells.get(key)?.delete("v");
      return;
    }
    let cell = cells.get(key);
    if (!cell) {
      cell = new Y.Map();
      cells.set(key, cell);
    }
    cell.set("v", value);
  }

  return {
    setCellValue(addr, value) {
      doc.transact(() => setValue(addr, value), LOCAL_ORIGIN);
    },
    clearRange(range) {
      // transact 하나 = undo 1단계 (S5)
      doc.transact(() => {
        for (const addr of cellsInRange(range)) {
          setValue(addr, "");
        }
      }, LOCAL_ORIGIN);
    },
    getCellValue(addr) {
      return cells.get(cellKey(addr))?.get("v") ?? "";
    },
    subscribe(listener) {
      cells.observeDeep(listener);
      return () => cells.unobserveDeep(listener);
    },
  };
}
