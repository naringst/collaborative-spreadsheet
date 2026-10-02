import * as Y from "yjs";
import type { CellAddress } from "../model/cell";
import type { CellAlign, CellFormatName } from "../model/cell-format";
import type { CellRange } from "../model/range";
import type { CellsMap } from "./cell-keys";
import { createFormatOps } from "./format-ops";
import { createValueOps, type CellSnapshot } from "./value-ops";

export type { CellSnapshot };

/** UndoManager trackedOrigins 대상. 로컬 편집은 반드시 이 origin의 transact로 실행한다. */
export const LOCAL_ORIGIN = Symbol("local");

export interface SheetStore {
  // 값 (value-ops)
  setCellValue(addr: CellAddress, value: string): void;
  clearRange(range: CellRange): void;
  getCellValue(addr: CellAddress): string;
  /** 여러 셀 값을 한 transact로 적용 — AI 적용을 undo 1회로 묶는다 (A5) */
  applyCellValues(changes: { addr: CellAddress; value: string }[]): void;
  /** 값이 있는 셀 전체를 주소·값·서식과 함께 반환 (AI 컨텍스트 D9·base 스냅샷) */
  snapshotValues(): CellSnapshot[];

  // 서식·스타일 (format-ops)
  /** 범위 전체 토글: 하나라도 꺼져 있으면 모두 켜고, 모두 켜져 있으면 모두 끈다 (S4) */
  toggleFormat(range: CellRange, format: CellFormatName): void;
  getCellFormat(addr: CellAddress, format: CellFormatName): boolean;
  /** 범위 전체에 정렬을 지정한다. null이면 지정 해제(자동: 숫자 오른쪽·그 외 왼쪽) */
  setCellAlign(range: CellRange, align: CellAlign | null): void;
  /** 지정된 정렬. 지정이 없으면 null — 기본값 판단은 값을 아는 쪽(UI)이 한다 */
  getCellAlign(addr: CellAddress): CellAlign | null;
  /** 범위 전체 글자 크기(px). 기본 크기면 키를 지운다 */
  setCellSize(range: CellRange, size: number): void;
  getCellSize(addr: CellAddress): number;

  /** isLocalChange: 이 탭의 편집·undo에서 비롯된 변경 (D6 원격 감지 구분용) */
  subscribe(listener: (info?: { isLocalChange: boolean }) => void): () => void;
}

/**
 * 셀은 평탄화된 단일 맵에 "r:c:속성" 키로 저장한다 (값: "r:c:v").
 * 중첩 Y.Map(셀 컨테이너)을 쓰면 두 탭이 같은 빈 셀에 동시에 값·서식을 넣을 때
 * 컨테이너가 LWW로 통째로 교체되어 한쪽이 소실된다 (C3·S4 위반).
 * 평탄 키는 속성마다 독립 병합되고, 컨테이너 생성 undo 문제(D7)도 원천적으로 없다.
 * 꺼진 서식·기본값·빈 값은 키가 없다 — 잔여 키가 남지 않는다.
 *
 * 연산 구현은 value-ops(값)·format-ops(서식·정렬·크기)에 있고,
 * 여기서는 맵·transact 경계·구독을 만들어 조립만 한다.
 */
export function createSheetStore(doc: Y.Doc): SheetStore {
  const cells: CellsMap = doc.getMap("cells");

  // transact 하나 = undo 1단계 (S5). 로컬 편집은 LOCAL_ORIGIN으로 묶어야
  // 에코 차단·내 변경만 undo가 성립한다.
  function transactLocal(fn: () => void) {
    doc.transact(fn, LOCAL_ORIGIN);
  }

  const formatOps = createFormatOps(cells, transactLocal);
  const valueOps = createValueOps(
    cells,
    transactLocal,
    formatOps.getCellFormat,
  );

  function subscribe(listener: (info?: { isLocalChange: boolean }) => void) {
    const handler = (
      _event: Y.YMapEvent<string | boolean | number>,
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
  }

  return { ...valueOps, ...formatOps, subscribe };
}
