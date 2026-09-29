import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { LOCAL_ORIGIN, createSheetStore } from "./sheet-store";

const A1 = { row: 0, col: 0 };
const B2 = { row: 1, col: 1 };

describe("S2 값 설정·조회", () => {
  it("설정한 값을 조회한다", () => {
    const store = createSheetStore(new Y.Doc());
    store.setCellValue(A1, "hello");
    expect(store.getCellValue(A1)).toBe("hello");
  });

  it("값이 없는 셀은 빈 문자열", () => {
    const store = createSheetStore(new Y.Doc());
    expect(store.getCellValue(B2)).toBe("");
  });

  it("값 덮어쓰기", () => {
    const store = createSheetStore(new Y.Doc());
    store.setCellValue(A1, "a");
    store.setCellValue(A1, "b");
    expect(store.getCellValue(A1)).toBe("b");
  });

  it("빈 문자열 설정은 값 제거와 같다", () => {
    const store = createSheetStore(new Y.Doc());
    store.setCellValue(A1, "x");
    store.setCellValue(A1, "");
    expect(store.getCellValue(A1)).toBe("");
  });

  it("시트 마지막 셀(99,25)도 저장된다", () => {
    const store = createSheetStore(new Y.Doc());
    const last = { row: 99, col: 25 };
    store.setCellValue(last, "end");
    expect(store.getCellValue(last)).toBe("end");
    expect(store.getCellValue({ row: 99, col: 24 })).toBe("");
  });
});

describe("S2 clearRange — 범위 지우기", () => {
  it("뒤집힌 범위도 전체가 지워진다", () => {
    const store = createSheetStore(new Y.Doc());
    store.setCellValue({ row: 0, col: 0 }, "a");
    store.setCellValue({ row: 1, col: 1 }, "b");
    store.setCellValue({ row: 2, col: 2 }, "c");
    store.clearRange({ anchor: { row: 2, col: 2 }, focus: { row: 0, col: 0 } });
    expect(store.getCellValue({ row: 0, col: 0 })).toBe("");
    expect(store.getCellValue({ row: 1, col: 1 })).toBe("");
    expect(store.getCellValue({ row: 2, col: 2 })).toBe("");
  });

  it("범위 밖 셀은 남는다", () => {
    const store = createSheetStore(new Y.Doc());
    store.setCellValue({ row: 0, col: 0 }, "in");
    store.setCellValue({ row: 5, col: 5 }, "out");
    store.clearRange({ anchor: { row: 0, col: 0 }, focus: { row: 1, col: 1 } });
    expect(store.getCellValue({ row: 5, col: 5 })).toBe("out");
  });

  it("빈 셀만 있는 범위를 지워도 오류가 없다", () => {
    const store = createSheetStore(new Y.Doc());
    expect(() =>
      store.clearRange({ anchor: { row: 3, col: 3 }, focus: { row: 4, col: 4 } }),
    ).not.toThrow();
    expect(store.getCellValue({ row: 3, col: 3 })).toBe("");
  });
});

describe("구독 알림", () => {
  it("값 변경 시 listener가 호출된다", () => {
    const store = createSheetStore(new Y.Doc());
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.setCellValue(A1, "v");
    expect(calls).toBeGreaterThan(0);
  });

  it("해제하면 더 이상 호출되지 않는다", () => {
    const store = createSheetStore(new Y.Doc());
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.setCellValue(A1, "v");
    const before = calls;
    unsubscribe();
    store.setCellValue(A1, "w");
    expect(calls).toBe(before);
  });
});

describe("S5 LOCAL_ORIGIN transact", () => {
  it("setCellValue는 LOCAL_ORIGIN으로 실행된다", () => {
    const doc = new Y.Doc();
    const store = createSheetStore(doc);
    const origins: unknown[] = [];
    doc.on("afterTransaction", (tr: Y.Transaction) => {
      origins.push(tr.origin);
    });
    store.setCellValue(A1, "v");
    expect(origins).toContain(LOCAL_ORIGIN);
    expect(origins.every((o) => o === LOCAL_ORIGIN)).toBe(true);
  });

  it("clearRange도 LOCAL_ORIGIN이며 transact 1회다", () => {
    const doc = new Y.Doc();
    const store = createSheetStore(doc);
    store.setCellValue({ row: 0, col: 0 }, "a");
    store.setCellValue({ row: 0, col: 1 }, "b");
    const origins: unknown[] = [];
    doc.on("afterTransaction", (tr: Y.Transaction) => {
      origins.push(tr.origin);
    });
    store.clearRange({ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 1 } });
    expect(origins).toEqual([LOCAL_ORIGIN]);
  });
});

describe("S5 undo 단위 — clearRange는 한 단계", () => {
  it("undo 한 번으로 범위 전체 값이 복원된다", () => {
    const doc = new Y.Doc();
    const store = createSheetStore(doc);
    // UndoManager는 편집이 일어나는 공유 타입 기준으로 추적한다.
    // 루트 공유 타입을 모두 커버하기 위해 이후 트랜잭션에서 변경된 타입을 수집한다.
    const changedTypes = new Set<Y.AbstractType<Y.YEvent<Y.Map<unknown>>>>();
    doc.on("afterTransaction", (tr: Y.Transaction) => {
      for (const type of tr.changed.keys()) {
        let root: Y.AbstractType<Y.YEvent<Y.Map<unknown>>> = type;
        while (root.parent) root = root.parent as typeof root;
        changedTypes.add(root);
      }
    });

    store.setCellValue({ row: 0, col: 0 }, "a");
    store.setCellValue({ row: 1, col: 1 }, "b");
    store.setCellValue({ row: 2, col: 2 }, "c");

    const undoManager = new Y.UndoManager([...changedTypes], {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: 0,
    });

    store.clearRange({ anchor: { row: 0, col: 0 }, focus: { row: 2, col: 2 } });
    expect(store.getCellValue({ row: 0, col: 0 })).toBe("");

    undoManager.undo();
    expect(store.getCellValue({ row: 0, col: 0 })).toBe("a");
    expect(store.getCellValue({ row: 1, col: 1 })).toBe("b");
    expect(store.getCellValue({ row: 2, col: 2 })).toBe("c");
  });
});
