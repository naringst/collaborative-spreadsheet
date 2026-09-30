import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { CellAddress } from "../model/cell";
import { LOCAL_ORIGIN, createSheetStore } from "./sheet-store";
import { createSheetUndo } from "./undo";

const A1: CellAddress = { row: 0, col: 0 };
const B2: CellAddress = { row: 1, col: 1 };
const C3: CellAddress = { row: 2, col: 2 };

function setup() {
  const doc = new Y.Doc();
  const store = createSheetStore(doc);
  const undo = createSheetUndo(doc);
  return { doc, store, undo };
}

describe("A5 applyCellValues — 여러 셀 반영", () => {
  it("전달한 모든 셀 값이 반영된다", () => {
    const { store } = setup();
    store.applyCellValues([
      { addr: A1, value: "a" },
      { addr: B2, value: "b" },
      { addr: C3, value: "c" },
    ]);
    expect(store.getCellValue(A1)).toBe("a");
    expect(store.getCellValue(B2)).toBe("b");
    expect(store.getCellValue(C3)).toBe("c");
  });

  it("기존 값을 덮어쓴다", () => {
    const { store } = setup();
    store.setCellValue(A1, "old");
    store.applyCellValues([{ addr: A1, value: "new" }]);
    expect(store.getCellValue(A1)).toBe("new");
  });

  it("빈 배열이면 아무 것도 바꾸지 않는다", () => {
    const { store } = setup();
    store.setCellValue(A1, "x");
    expect(() => store.applyCellValues([])).not.toThrow();
    expect(store.getCellValue(A1)).toBe("x");
  });

  it("마지막 셀(99,25)도 반영된다", () => {
    const { store } = setup();
    const last: CellAddress = { row: 99, col: 25 };
    store.applyCellValues([{ addr: last, value: "end" }]);
    expect(store.getCellValue(last)).toBe("end");
  });
});

describe("A5 applyCellValues — LOCAL_ORIGIN transact 1회", () => {
  it("여러 셀 반영이 transact 1회로 실행된다", () => {
    const { doc, store } = setup();
    const origins: unknown[] = [];
    doc.on("afterTransaction", (tr: Y.Transaction) => {
      origins.push(tr.origin);
    });
    store.applyCellValues([
      { addr: A1, value: "a" },
      { addr: B2, value: "b" },
    ]);
    expect(origins).toEqual([LOCAL_ORIGIN]);
  });
});

describe("A5 applyCellValues — undo 1회로 전체 되돌림", () => {
  it("적용한 AI 편집 전체가 undo 1회로 되돌아간다", () => {
    const { store, undo } = setup();
    store.applyCellValues([
      { addr: A1, value: "a" },
      { addr: B2, value: "b" },
      { addr: C3, value: "c" },
    ]);
    undo.undo();
    expect(store.getCellValue(A1)).toBe("");
    expect(store.getCellValue(B2)).toBe("");
    expect(store.getCellValue(C3)).toBe("");
    expect(undo.canUndo()).toBe(false);
  });

  it("적용 직전 입력과 합쳐지지 않는다 (별도 undo 단계, A5)", () => {
    const { store, undo } = setup();
    store.setCellValue(A1, "typed");
    store.applyCellValues([{ addr: B2, value: "ai" }]);
    undo.undo();
    // AI 적용만 되돌아가고 직전 입력은 남는다
    expect(store.getCellValue(B2)).toBe("");
    expect(store.getCellValue(A1)).toBe("typed");
  });
});

describe("D9 snapshotValues — 값 있는 셀만", () => {
  it("값이 있는 셀만 반환한다", () => {
    const { store } = setup();
    store.setCellValue(A1, "a");
    store.setCellValue(C3, "c");
    const snap = store.snapshotValues();
    const cells = snap.map((s) => s.value).sort();
    expect(cells).toEqual(["a", "c"]);
  });

  it("빈 시트는 빈 배열", () => {
    const { store } = setup();
    expect(store.snapshotValues()).toEqual([]);
  });

  it("값을 지운 셀은 스냅샷에서 빠진다", () => {
    const { store } = setup();
    store.setCellValue(A1, "a");
    store.setCellValue(A1, "");
    expect(store.snapshotValues()).toEqual([]);
  });

  it("서식은 있지만 값이 없는 셀은 스냅샷에 없다 (:v 키 기준)", () => {
    const { store } = setup();
    store.toggleFormat({ anchor: A1, focus: A1 }, "bold");
    // 값이 없으므로 스냅샷에 포함되지 않아야 한다
    expect(
      store.snapshotValues().some((s) => s.addr.row === 0 && s.addr.col === 0),
    ).toBe(false);
  });

  it("반환 항목은 주소·값·서식을 담는다", () => {
    const { store } = setup();
    store.setCellValue(B2, "v");
    store.toggleFormat({ anchor: B2, focus: B2 }, "bold");
    const snap = store.snapshotValues();
    const entry = snap.find((s) => s.addr.row === 1 && s.addr.col === 1);
    expect(entry).toBeDefined();
    expect(entry?.value).toBe("v");
    expect(entry?.formats).toContain("bold");
  });
});
