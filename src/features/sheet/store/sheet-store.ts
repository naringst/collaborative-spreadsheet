import * as Y from "yjs";
import { cellKey, type CellAddress } from "../model/cell";
import { cellsInRange, type CellRange } from "../model/range";

/** UndoManager trackedOrigins 대상. 로컬 편집은 반드시 이 origin의 transact로 실행한다. */
export const LOCAL_ORIGIN = Symbol("local");

export interface SheetStore {
  setCellValue(addr: CellAddress, value: string): void;
  clearRange(range: CellRange): void;
  getCellValue(addr: CellAddress): string;
  /** isLocalChange: 이 탭의 편집·undo에서 비롯된 변경 (D6 원격 감지 구분용) */
  subscribe(listener: (info?: { isLocalChange: boolean }) => void): () => void;
}

/**
 * 셀은 평탄화된 단일 맵에 "r:c:속성" 키로 저장한다 (값: "r:c:v").
 * 중첩 Y.Map(셀 컨테이너)을 쓰면 두 탭이 같은 빈 셀에 동시에 값·서식을 넣을 때
 * 컨테이너가 LWW로 통째로 교체되어 한쪽이 소실된다 (C3·S4 위반).
 * 평탄 키는 속성마다 독립 병합되고, 컨테이너 생성 undo 문제(D7)도 원천적으로 없다.
 */
function valueKey(addr: CellAddress): string {
  return `${cellKey(addr)}:v`;
}

export function createSheetStore(doc: Y.Doc): SheetStore {
  const cells = doc.getMap<string>("cells");

  function getValue(addr: CellAddress): string {
    return cells.get(valueKey(addr)) ?? "";
  }

  function setValue(addr: CellAddress, value: string) {
    // 값이 같으면 쓰지 않는다 — 무변경 커밋(Enter만 누름)이 undo 단계를 만들지 않게
    if (getValue(addr) === value) return;
    if (value === "") {
      // 빈 값은 키를 지워 "값 없음"과 "빈 문자열"이 갈라지지 않게 한다.
      cells.delete(valueKey(addr));
      return;
    }
    cells.set(valueKey(addr), value);
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
    getCellValue: getValue,
    subscribe(listener) {
      const handler = (
        _event: Y.YMapEvent<string>,
        transaction: Y.Transaction,
      ) => {
        listener({
          isLocalChange:
            transaction.origin === LOCAL_ORIGIN ||
            transaction.origin instanceof Y.UndoManager, // 내 undo/redo도 로컬 변경
        });
      };
      cells.observe(handler);
      return () => cells.unobserve(handler);
    },
  };
}
