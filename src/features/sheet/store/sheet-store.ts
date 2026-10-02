import * as Y from "yjs";
import { cellKey, type CellAddress } from "../model/cell";
import {
  CELL_FORMATS,
  DEFAULT_FONT_SIZE,
  isCellAlign,
  type CellAlign,
  type CellFormatName,
} from "../model/cell-format";
import { formatKey, parseCellKey, styleKey } from "./cell-keys";
import { cellsInRange, type CellRange } from "../model/range";

export interface CellSnapshot {
  addr: CellAddress;
  value: string;
  formats: CellFormatName[];
}

/** UndoManager trackedOrigins 대상. 로컬 편집은 반드시 이 origin의 transact로 실행한다. */
export const LOCAL_ORIGIN = Symbol("local");

export interface SheetStore {
  setCellValue(addr: CellAddress, value: string): void;
  clearRange(range: CellRange): void;
  getCellValue(addr: CellAddress): string;
  /** 여러 셀 값을 한 transact로 적용 — AI 적용을 undo 1회로 묶는다 (A5) */
  applyCellValues(changes: { addr: CellAddress; value: string }[]): void;
  /** 값이 있는 셀 전체를 주소·값·서식과 함께 반환 (AI 컨텍스트 D9·base 스냅샷) */
  snapshotValues(): CellSnapshot[];
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
 */
function valueKey(addr: CellAddress): string {
  return `${cellKey(addr)}:v`;
}

export function createSheetStore(doc: Y.Doc): SheetStore {
  // 값("r:c:v")은 string, 서식("r:c:bold" 등)은 true, 정렬("r:c:align")은 string,
  // 크기("r:c:size")는 number. 꺼진 서식·기본값은 키가 없다 — 빈 값 = 키 삭제
  // 규약과 대칭이라 false·기본값 잔여 키가 남지 않는다.
  const cells = doc.getMap<string | boolean | number>("cells");

  function getCellValue(addr: CellAddress): string {
    const v = cells.get(valueKey(addr));
    return typeof v === "string" ? v : "";
  }

  function getCellFormat(addr: CellAddress, format: CellFormatName): boolean {
    return cells.get(formatKey(addr, format)) === true;
  }

  function getCellAlign(addr: CellAddress): CellAlign | null {
    const v = cells.get(styleKey(addr, "align"));
    return isCellAlign(v) ? v : null;
  }

  function getCellSize(addr: CellAddress): number {
    const v = cells.get(styleKey(addr, "size"));
    return typeof v === "number" ? v : DEFAULT_FONT_SIZE;
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

  // transact 하나 = undo 1단계 (S5). 로컬 편집은 LOCAL_ORIGIN으로 묶어야
  // 에코 차단·내 변경만 undo가 성립한다.
  function transactLocal(fn: () => void) {
    doc.transact(fn, LOCAL_ORIGIN);
  }

  // 범위의 각 셀에 edit을 적용하는 공통 뼈대 (clear·서식·정렬·크기가 공유)
  function editRange(range: CellRange, edit: (addr: CellAddress) => void) {
    transactLocal(() => {
      for (const addr of cellsInRange(range)) edit(addr);
    });
  }

  function setCellValue(addr: CellAddress, value: string) {
    transactLocal(() => setValue(addr, value));
  }

  function clearRange(range: CellRange) {
    editRange(range, (addr) => setValue(addr, ""));
  }

  function applyCellValues(changes: { addr: CellAddress; value: string }[]) {
    transactLocal(() => {
      for (const { addr, value } of changes) setValue(addr, value);
    });
  }

  function snapshotValues(): CellSnapshot[] {
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
  }

  function toggleFormat(range: CellRange, format: CellFormatName) {
    const allOn = cellsInRange(range).every((addr) =>
      getCellFormat(addr, format),
    );
    // 이미 맞는 상태의 셀은 건드리지 않는다 — undo가 정확히 원래 상태로 복구된다
    editRange(range, (addr) => {
      const key = formatKey(addr, format);
      if (allOn) cells.delete(key);
      else if (!getCellFormat(addr, format)) cells.set(key, true);
    });
  }

  function setCellAlign(range: CellRange, align: CellAlign | null) {
    // 이미 같은 값인 셀은 건드리지 않는다 — undo가 정확히 원래 상태로 복구된다
    editRange(range, (addr) => {
      if (getCellAlign(addr) === align) return;
      const key = styleKey(addr, "align");
      if (align === null) cells.delete(key);
      else cells.set(key, align);
    });
  }

  function setCellSize(range: CellRange, size: number) {
    editRange(range, (addr) => {
      if (getCellSize(addr) === size) return;
      const key = styleKey(addr, "size");
      if (size === DEFAULT_FONT_SIZE) cells.delete(key);
      else cells.set(key, size);
    });
  }

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

  return {
    setCellValue,
    clearRange,
    applyCellValues,
    snapshotValues,
    getCellValue,
    toggleFormat,
    getCellFormat,
    setCellAlign,
    getCellAlign,
    setCellSize,
    getCellSize,
    subscribe,
  };
}
