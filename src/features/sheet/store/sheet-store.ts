import * as Y from "yjs";
import { cellKey, type CellAddress } from "../model/cell";
import { cellsInRange, type CellRange } from "../model/range";

/** UndoManager trackedOrigins 대상. 로컬 편집은 반드시 이 origin의 transact로 실행한다. */
export const LOCAL_ORIGIN = Symbol("local");

/**
 * 셀 컨테이너(Y.Map) 생성 전용 origin — undo에서 추적하지 않는다.
 * 컨테이너 생성이 undo 스택에 들어가면, 원격이 같은 셀을 덮어쓴 뒤 내 undo가
 * 컨테이너째 지워 원격 값까지 사라진다 (D7 위반). 값 키만 LOCAL로 추적한다.
 */
const CONTAINER_ORIGIN = Symbol("cell-container");

export interface SheetStore {
  setCellValue(addr: CellAddress, value: string): void;
  clearRange(range: CellRange): void;
  getCellValue(addr: CellAddress): string;
  /** isLocalChange: 이 탭의 편집·undo에서 비롯된 변경 (D6 원격 감지 구분용) */
  subscribe(listener: (info?: { isLocalChange: boolean }) => void): () => void;
}

type CellMap = Y.Map<string>;

export function createSheetStore(doc: Y.Doc): SheetStore {
  const cells = doc.getMap<CellMap>("cells");

  function ensureCell(addr: CellAddress): CellMap {
    const key = cellKey(addr);
    let cell = cells.get(key);
    if (!cell) {
      const created = new Y.Map<string>();
      doc.transact(() => cells.set(key, created), CONTAINER_ORIGIN);
      cell = created;
    }
    return cell;
  }

  function getValue(addr: CellAddress): string {
    return cells.get(cellKey(addr))?.get("v") ?? "";
  }

  function setValue(addr: CellAddress, value: string) {
    // 값이 같으면 쓰지 않는다 — 무변경 커밋(Enter만 누름)이 undo 단계를 만들지 않게
    if (getValue(addr) === value) return;
    if (value === "") {
      // 빈 값은 키를 지워 "값 없음"과 "빈 문자열"이 갈라지지 않게 한다.
      cells.get(cellKey(addr))?.delete("v");
      return;
    }
    ensureCell(addr).set("v", value);
  }

  return {
    setCellValue(addr, value) {
      // 컨테이너 생성(CONTAINER_ORIGIN)이 LOCAL transact 안에 섞이지 않도록 먼저 보장한다
      if (value !== "") ensureCell(addr);
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
    getCellValue: getValue,
    subscribe(listener) {
      const handler = (
        _events: Y.YEvent<Y.Map<string>>[],
        transaction: Y.Transaction,
      ) => {
        listener({
          isLocalChange:
            transaction.origin === LOCAL_ORIGIN ||
            transaction.origin instanceof Y.UndoManager, // 내 undo/redo도 로컬 변경
        });
      };
      cells.observeDeep(handler);
      return () => cells.unobserveDeep(handler);
    },
  };
}
