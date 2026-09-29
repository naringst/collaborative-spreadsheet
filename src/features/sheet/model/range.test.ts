import { describe, expect, it } from "vitest";
import { cellsInRange, normalizeRange, rangeContains } from "./range";
import { cellKey } from "./cell";

describe("S1 normalizeRange", () => {
  it("정방향 범위", () => {
    expect(
      normalizeRange({ anchor: { row: 1, col: 1 }, focus: { row: 3, col: 4 } }),
    ).toEqual({ top: 1, left: 1, bottom: 3, right: 4 });
  });

  it("뒤집힌 범위(focus가 anchor보다 앞)도 같은 직사각형으로 정규화된다", () => {
    expect(
      normalizeRange({ anchor: { row: 3, col: 4 }, focus: { row: 1, col: 1 } }),
    ).toEqual({ top: 1, left: 1, bottom: 3, right: 4 });
  });

  it("행만 뒤집힌 범위", () => {
    expect(
      normalizeRange({ anchor: { row: 5, col: 2 }, focus: { row: 2, col: 6 } }),
    ).toEqual({ top: 2, left: 2, bottom: 5, right: 6 });
  });

  it("단일 셀 범위", () => {
    expect(
      normalizeRange({ anchor: { row: 2, col: 3 }, focus: { row: 2, col: 3 } }),
    ).toEqual({ top: 2, left: 3, bottom: 2, right: 3 });
  });
});

describe("S1 rangeContains", () => {
  const range = { anchor: { row: 4, col: 5 }, focus: { row: 1, col: 2 } }; // 뒤집힘

  it("내부·경계 셀 포함", () => {
    expect(rangeContains(range, { row: 2, col: 3 })).toBe(true);
    expect(rangeContains(range, { row: 1, col: 2 })).toBe(true);
    expect(rangeContains(range, { row: 4, col: 5 })).toBe(true);
  });

  it("바깥 셀 미포함", () => {
    expect(rangeContains(range, { row: 0, col: 3 })).toBe(false);
    expect(rangeContains(range, { row: 5, col: 3 })).toBe(false);
    expect(rangeContains(range, { row: 2, col: 1 })).toBe(false);
    expect(rangeContains(range, { row: 2, col: 6 })).toBe(false);
  });

  it("단일 셀 범위는 그 셀만 포함", () => {
    const single = { anchor: { row: 3, col: 3 }, focus: { row: 3, col: 3 } };
    expect(rangeContains(single, { row: 3, col: 3 })).toBe(true);
    expect(rangeContains(single, { row: 3, col: 4 })).toBe(false);
  });
});

describe("S1 cellsInRange", () => {
  it("직사각형의 모든 셀을 반환한다", () => {
    const cells = cellsInRange({
      anchor: { row: 1, col: 1 },
      focus: { row: 2, col: 3 },
    });
    expect(cells).toHaveLength(6);
    const keys = new Set(cells.map(cellKey));
    expect(keys.size).toBe(6);
    expect(keys.has("1:1")).toBe(true);
    expect(keys.has("2:3")).toBe(true);
  });

  it("뒤집힌 범위도 같은 셀 집합", () => {
    const forward = cellsInRange({
      anchor: { row: 1, col: 1 },
      focus: { row: 2, col: 3 },
    });
    const reversed = cellsInRange({
      anchor: { row: 2, col: 3 },
      focus: { row: 1, col: 1 },
    });
    expect(new Set(reversed.map(cellKey))).toEqual(new Set(forward.map(cellKey)));
  });

  it("단일 셀 범위는 셀 1개", () => {
    const cells = cellsInRange({
      anchor: { row: 0, col: 0 },
      focus: { row: 0, col: 0 },
    });
    expect(cells).toEqual([{ row: 0, col: 0 }]);
  });
});
