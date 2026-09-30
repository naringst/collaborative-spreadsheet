import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  CELL_FORMATS,
  formatKey,
  type CellAddress,
  type CellFormatName,
} from "../model/cell";
import type { CellRange } from "../model/range";
import { createSheetStore } from "./sheet-store";
import { createSheetUndo } from "./undo";

const A1: CellAddress = { row: 0, col: 0 };
const B2: CellAddress = { row: 1, col: 1 };
const LAST: CellAddress = { row: 99, col: 25 };

function single(addr: CellAddress): CellRange {
  return { anchor: addr, focus: addr };
}

function setup() {
  const doc = new Y.Doc();
  const store = createSheetStore(doc);
  const undo = createSheetUndo(doc);
  return { doc, store, undo };
}

/** source의 편집을 target에 원격 origin으로 적용 (C7: undo 미적재 확인용) */
function applyRemote(target: Y.Doc, source: Y.Doc) {
  const update = Y.encodeStateAsUpdate(source, Y.encodeStateVector(target));
  Y.applyUpdate(target, update, "remote-peer");
}

describe("S4 formatKey — 서식 키", () => {
  it('"r:c:서식" 형식이다', () => {
    expect(formatKey({ row: 3, col: 7 }, "bold")).toBe("3:7:bold");
    expect(formatKey({ row: 0, col: 0 }, "strike")).toBe("0:0:strike");
  });

  it("CELL_FORMATS는 굵게·기울임·밑줄·취소선 (D3)", () => {
    expect([...CELL_FORMATS]).toEqual([
      "bold",
      "italic",
      "underline",
      "strike",
    ]);
  });
});

describe("S4 서식 토글", () => {
  it("기본값은 false", () => {
    const { store } = setup();
    for (const f of CELL_FORMATS) {
      expect(store.getCellFormat(A1, f)).toBe(false);
    }
  });

  it("단일 셀 토글 왕복: 켜기 → 끄기", () => {
    const { store } = setup();
    store.toggleFormat(single(A1), "bold");
    expect(store.getCellFormat(A1, "bold")).toBe(true);
    store.toggleFormat(single(A1), "bold");
    expect(store.getCellFormat(A1, "bold")).toBe(false);
  });

  it("범위 토글은 범위 전체에 적용되고 범위 밖은 건드리지 않는다", () => {
    const { store } = setup();
    const range: CellRange = { anchor: A1, focus: B2 };
    store.toggleFormat(range, "italic");
    for (const addr of [A1, { row: 0, col: 1 }, { row: 1, col: 0 }, B2]) {
      expect(store.getCellFormat(addr, "italic")).toBe(true);
    }
    expect(store.getCellFormat({ row: 2, col: 2 }, "italic")).toBe(false);
  });

  it("섞인 범위는 모두 켜기, 모두 켜진 뒤 다시 토글하면 모두 끄기", () => {
    const { store } = setup();
    store.toggleFormat(single(A1), "bold");
    const range: CellRange = { anchor: A1, focus: B2 };

    store.toggleFormat(range, "bold");
    for (const addr of [A1, { row: 0, col: 1 }, { row: 1, col: 0 }, B2]) {
      expect(store.getCellFormat(addr, "bold")).toBe(true);
    }

    store.toggleFormat(range, "bold");
    for (const addr of [A1, { row: 0, col: 1 }, { row: 1, col: 0 }, B2]) {
      expect(store.getCellFormat(addr, "bold")).toBe(false);
    }
  });

  it("뒤집힌 범위(focus가 anchor보다 앞)도 전체에 적용된다", () => {
    const { store } = setup();
    store.toggleFormat({ anchor: B2, focus: A1 }, "underline");
    expect(store.getCellFormat(A1, "underline")).toBe(true);
    expect(store.getCellFormat({ row: 0, col: 1 }, "underline")).toBe(true);
    expect(store.getCellFormat(B2, "underline")).toBe(true);
  });

  it("시트 마지막 셀(99,25)에도 서식이 적용된다", () => {
    const { store } = setup();
    store.toggleFormat(single(LAST), "strike");
    expect(store.getCellFormat(LAST, "strike")).toBe(true);
  });

  it("서식끼리 독립: bold 토글은 italic에 영향 없다", () => {
    const { store } = setup();
    store.toggleFormat(single(A1), "italic");
    store.toggleFormat(single(A1), "bold");
    expect(store.getCellFormat(A1, "italic")).toBe(true);
    store.toggleFormat(single(A1), "bold");
    expect(store.getCellFormat(A1, "italic")).toBe(true);
    expect(store.getCellFormat(A1, "bold")).toBe(false);
  });

  it("값 없는 빈 셀에도 서식이 적용되고 값은 빈 문자열 그대로다", () => {
    const { store } = setup();
    store.toggleFormat(single(B2), "bold");
    expect(store.getCellFormat(B2, "bold")).toBe(true);
    expect(store.getCellValue(B2)).toBe("");
  });
});

describe("S2/S4 값과 서식의 독립", () => {
  it("clearRange는 값만 지우고 서식은 유지한다 (S2)", () => {
    const { store } = setup();
    store.setCellValue(A1, "hello");
    store.toggleFormat(single(A1), "bold");
    store.toggleFormat(single(A1), "underline");
    store.clearRange({ anchor: A1, focus: B2 });
    expect(store.getCellValue(A1)).toBe("");
    expect(store.getCellFormat(A1, "bold")).toBe(true);
    expect(store.getCellFormat(A1, "underline")).toBe(true);
  });

  it("setCellValue는 서식에 영향을 주지 않는다", () => {
    const { store } = setup();
    store.toggleFormat(single(A1), "italic");
    store.setCellValue(A1, "x");
    store.setCellValue(A1, "");
    expect(store.getCellFormat(A1, "italic")).toBe(true);
  });

  it("toggleFormat은 셀 값에 영향을 주지 않는다", () => {
    const { store } = setup();
    store.setCellValue(A1, "keep");
    store.toggleFormat(single(A1), "bold");
    store.toggleFormat(single(A1), "bold");
    expect(store.getCellValue(A1)).toBe("keep");
  });
});

describe("S5 서식 undo/redo", () => {
  it("서식 적용 1회는 undo 1단계", () => {
    const { store, undo } = setup();
    store.toggleFormat(single(A1), "bold");
    expect(undo.canUndo()).toBe(true);
    undo.undo();
    expect(store.getCellFormat(A1, "bold")).toBe(false);
    expect(undo.canUndo()).toBe(false);
  });

  it("섞인 범위 토글은 undo 1회로 섞임 상태로 정확히 복원, redo로 전부 켜짐", () => {
    const { store, undo } = setup();
    const range: CellRange = { anchor: A1, focus: B2 };
    // 섞인 상태 만들기: A1만 bold
    store.toggleFormat(single(A1), "bold");

    store.toggleFormat(range, "bold"); // 모두 켜기 = 1단계

    undo.undo();
    expect(store.getCellFormat(A1, "bold")).toBe(true);
    expect(store.getCellFormat({ row: 0, col: 1 }, "bold")).toBe(false);
    expect(store.getCellFormat({ row: 1, col: 0 }, "bold")).toBe(false);
    expect(store.getCellFormat(B2, "bold")).toBe(false);

    undo.redo();
    for (const addr of [A1, { row: 0, col: 1 }, { row: 1, col: 0 }, B2]) {
      expect(store.getCellFormat(addr, "bold")).toBe(true);
    }
  });

  it("같은 상태 재토글(왕복) 후 undo하면 켜진 상태로 돌아간다", () => {
    const { store, undo } = setup();
    store.toggleFormat(single(A1), "bold"); // on
    store.toggleFormat(single(A1), "bold"); // off
    undo.undo();
    expect(store.getCellFormat(A1, "bold")).toBe(true);
    undo.undo();
    expect(store.getCellFormat(A1, "bold")).toBe(false);
  });
});

describe("C7 원격 서식 변경과 undo", () => {
  it("원격 서식 변경은 내 undo 스택에 쌓이지 않는다", () => {
    const { doc: docA, store: storeA, undo: undoA } = setup();
    const docB = new Y.Doc();
    const storeB = createSheetStore(docB);

    storeB.toggleFormat(single(A1), "bold");
    applyRemote(docA, docB);

    expect(storeA.getCellFormat(A1, "bold")).toBe(true);
    expect(undoA.canUndo()).toBe(false);
  });

  it("undo는 내 서식 변경만 되돌리고 원격 변경은 남긴다", () => {
    const { doc: docA, store: storeA, undo: undoA } = setup();
    const docB = new Y.Doc();
    const storeB = createSheetStore(docB);

    storeA.toggleFormat(single(A1), "italic"); // 내 변경
    storeB.toggleFormat(single(B2), "bold"); // 원격 변경
    applyRemote(docA, docB);

    undoA.undo();
    expect(storeA.getCellFormat(A1, "italic")).toBe(false);
    expect(storeA.getCellFormat(B2, "bold")).toBe(true);
    expect(undoA.canUndo()).toBe(false);
  });
});

describe("C3 값·서식 동시 편집 수렴", () => {
  function converged(localFmt: CellFormatName): {
    a: ReturnType<typeof createSheetStore>;
    b: ReturnType<typeof createSheetStore>;
  } {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const storeA = createSheetStore(docA);
    const storeB = createSheetStore(docB);

    // 동시(오프라인) 편집: A는 값, B는 같은 셀 서식
    storeA.setCellValue(A1, "value-from-A");
    storeB.toggleFormat(single(A1), localFmt);

    const updA = Y.encodeStateAsUpdate(docA);
    const updB = Y.encodeStateAsUpdate(docB);
    // 서로 다른 순서로 교차 적용
    Y.applyUpdate(docA, updB, "remote-peer");
    Y.applyUpdate(docB, updA, "remote-peer");
    return { a: storeA, b: storeB };
  }

  it("같은 셀의 값(A)과 bold(B)가 병합 후 양쪽 문서에 모두 생존한다", () => {
    const { a, b } = converged("bold");
    for (const store of [a, b]) {
      expect(store.getCellValue(A1)).toBe("value-from-A");
      expect(store.getCellFormat(A1, "bold")).toBe(true);
    }
  });

  it("서로 다른 서식을 같은 셀에 동시에 적용해도 둘 다 남는다", () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const storeA = createSheetStore(docA);
    const storeB = createSheetStore(docB);

    storeA.toggleFormat(single(A1), "bold");
    storeB.toggleFormat(single(A1), "italic");

    const updA = Y.encodeStateAsUpdate(docA);
    const updB = Y.encodeStateAsUpdate(docB);
    Y.applyUpdate(docB, updA, "remote-peer");
    Y.applyUpdate(docA, updB, "remote-peer");

    for (const store of [storeA, storeB]) {
      expect(store.getCellFormat(A1, "bold")).toBe(true);
      expect(store.getCellFormat(A1, "italic")).toBe(true);
    }
  });
});
