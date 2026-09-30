import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import type { CellAddress } from "../model/cell";
import { createSheetStore } from "./sheet-store";
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

/** source에서 만든 편집을 target에 원격 origin으로 적용한다. */
function applyRemote(target: Y.Doc, source: Y.Doc) {
  const update = Y.encodeStateAsUpdate(source, Y.encodeStateVector(target));
  Y.applyUpdate(target, update, "remote-peer");
}

describe("S5 실행 취소 / 다시 실행", () => {
  it("값 확정 1회는 undo 1단계로 되돌아간다", () => {
    const { store, undo } = setup();
    store.setCellValue(A1, "hello");
    expect(undo.canUndo()).toBe(true);
    undo.undo();
    expect(store.getCellValue(A1)).toBe("");
    expect(undo.canUndo()).toBe(false);
  });

  it("빠른 연속 setCellValue는 각각 별도 단계다", () => {
    const { store, undo } = setup();
    store.setCellValue(A1, "first");
    store.setCellValue(A1, "second");
    undo.undo();
    expect(store.getCellValue(A1)).toBe("first");
    undo.undo();
    expect(store.getCellValue(A1)).toBe("");
  });

  it("서로 다른 셀의 연속 입력도 각각 별도 단계다", () => {
    const { store, undo } = setup();
    store.setCellValue(A1, "a");
    store.setCellValue(B2, "b");
    undo.undo();
    expect(store.getCellValue(B2)).toBe("");
    expect(store.getCellValue(A1)).toBe("a");
  });

  it("같은 값을 재입력해도 undo가 상태를 깨지 않는다", () => {
    const { store, undo } = setup();
    store.setCellValue(A1, "same");
    store.setCellValue(A1, "same");
    while (undo.canUndo()) undo.undo();
    expect(store.getCellValue(A1)).toBe("");
  });

  it("clearRange는 undo 1회로 범위 전체가 복원된다", () => {
    const { store, undo } = setup();
    store.setCellValue(A1, "a");
    store.setCellValue(B2, "b");
    store.setCellValue(C3, "c");
    store.clearRange({ anchor: A1, focus: C3 });
    expect(store.getCellValue(B2)).toBe("");
    undo.undo();
    expect(store.getCellValue(A1)).toBe("a");
    expect(store.getCellValue(B2)).toBe("b");
    expect(store.getCellValue(C3)).toBe("c");
  });

  it("redo는 되돌린 변경을 다시 적용한다", () => {
    const { store, undo } = setup();
    store.setCellValue(A1, "x");
    undo.undo();
    expect(undo.canRedo()).toBe(true);
    undo.redo();
    expect(store.getCellValue(A1)).toBe("x");
    expect(undo.canRedo()).toBe(false);
    expect(undo.canUndo()).toBe(true);
  });

  it("undo 후 새 편집을 하면 redo가 불가능해진다", () => {
    const { store, undo } = setup();
    store.setCellValue(A1, "x");
    undo.undo();
    store.setCellValue(B2, "y");
    expect(undo.canRedo()).toBe(false);
  });

  it("스택이 비었을 때 undo/redo는 상태를 바꾸지 않고 예외도 던지지 않는다", () => {
    const { store, undo } = setup();
    expect(undo.canUndo()).toBe(false);
    expect(undo.canRedo()).toBe(false);
    expect(() => {
      undo.undo();
      undo.redo();
    }).not.toThrow();
    expect(store.getCellValue(A1)).toBe("");
  });

  it("subscribe는 스택 변화(편집·undo·redo)마다 통지한다", () => {
    const { store, undo } = setup();
    const listener = vi.fn();
    undo.subscribe(listener);

    store.setCellValue(A1, "x");
    const afterEdit = listener.mock.calls.length;
    expect(afterEdit).toBeGreaterThan(0);

    undo.undo();
    const afterUndo = listener.mock.calls.length;
    expect(afterUndo).toBeGreaterThan(afterEdit);

    undo.redo();
    expect(listener.mock.calls.length).toBeGreaterThan(afterUndo);
  });

  it("subscribe 해제 후에는 통지되지 않는다", () => {
    const { store, undo } = setup();
    const listener = vi.fn();
    const unsubscribe = undo.subscribe(listener);
    unsubscribe();
    store.setCellValue(A1, "x");
    undo.undo();
    expect(listener).not.toHaveBeenCalled();
  });

  it("onReverted는 undo가 되돌린 셀 주소를 전달한다 (S5 P1)", () => {
    const { store, undo } = setup();
    const reverted: (CellAddress | null)[] = [];
    undo.onReverted((addr) => reverted.push(addr));
    store.setCellValue(B2, "x");
    undo.undo();
    expect(reverted).toHaveLength(1);
    expect(reverted[0]).toMatchObject({ row: 1, col: 1 });
  });

  it("onReverted는 redo가 되돌린 셀 주소도 전달한다", () => {
    const { store, undo } = setup();
    const reverted: (CellAddress | null)[] = [];
    store.setCellValue(B2, "x");
    undo.undo();
    undo.onReverted((addr) => reverted.push(addr));
    undo.redo();
    expect(reverted).toHaveLength(1);
    expect(reverted[0]).toMatchObject({ row: 1, col: 1 });
  });

  it("onReverted 해제 후에는 호출되지 않는다", () => {
    const { store, undo } = setup();
    const cb = vi.fn();
    const off = undo.onReverted(cb);
    off();
    store.setCellValue(A1, "x");
    undo.undo();
    expect(cb).not.toHaveBeenCalled();
  });

  it("일반 편집은 onReverted를 호출하지 않는다 (undo/redo 시에만)", () => {
    const { store, undo } = setup();
    const cb = vi.fn();
    undo.onReverted(cb);
    store.setCellValue(A1, "x");
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("C7 내 변경만 되돌리기", () => {
  it("원격 update를 적용해도 canUndo가 생기지 않는다", () => {
    const { store: _store, undo, doc: docA } = setup();
    const docB = new Y.Doc();
    const storeB = createSheetStore(docB);
    storeB.setCellValue(A1, "remote");
    applyRemote(docA, docB);
    expect(_store.getCellValue(A1)).toBe("remote");
    expect(undo.canUndo()).toBe(false);
  });

  it("내 undo는 원격이 만든 셀을 건드리지 않는다", () => {
    const { store, undo, doc: docA } = setup();
    const docB = new Y.Doc();
    const storeB = createSheetStore(docB);

    store.setCellValue(A1, "mine");
    storeB.setCellValue(B2, "theirs");
    applyRemote(docA, docB);

    undo.undo();
    expect(store.getCellValue(A1)).toBe("");
    expect(store.getCellValue(B2)).toBe("theirs");
    // 원격 변경까지 스택에 남아 있으면 안 된다
    expect(undo.canUndo()).toBe(false);
  });

  it("원격 변경이 들어와도 내 undo 스택이 사라지지 않는다", () => {
    const { store, undo, doc: docA } = setup();
    const docB = new Y.Doc();
    const storeB = createSheetStore(docB);

    store.setCellValue(A1, "mine");
    expect(undo.canUndo()).toBe(true);
    storeB.setCellValue(B2, "theirs");
    applyRemote(docA, docB);

    expect(undo.canUndo()).toBe(true);
    undo.undo();
    expect(store.getCellValue(A1)).toBe("");
  });

  it("내가 바꾼 셀을 원격이 덮어쓴 뒤 내 undo → 원격 값 유지 (D7)", () => {
    const { store, undo, doc: docA } = setup();
    const docB = new Y.Doc();
    const storeB = createSheetStore(docB);

    store.setCellValue(A1, "mine");
    // 원격이 내 값을 본 뒤 덮어쓰도록 내 update를 먼저 전달한다
    applyRemote(docB, docA);
    storeB.setCellValue(A1, "theirs");
    applyRemote(docA, docB);
    expect(store.getCellValue(A1)).toBe("theirs");

    undo.undo();
    expect(store.getCellValue(A1)).toBe("theirs");
  });

  it("destroy 후에는 편집해도 스택이 쌓이지 않는다", () => {
    const { store, undo } = setup();
    undo.destroy();
    store.setCellValue(A1, "x");
    expect(undo.canUndo()).toBe(false);
  });
});
