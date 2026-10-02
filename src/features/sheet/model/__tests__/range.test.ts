import { describe, expect, it } from "vitest";
import {
  cellsInRange,
  normalizeRange,
  rangeContains,
  rangeOverlaps,
} from "../range";
import type { CellRange } from "../range";
import { cellKey } from "../cell";

function range(
  a: [number, number],
  f: [number, number] = a,
): CellRange {
  return {
    anchor: { row: a[0], col: a[1] },
    focus: { row: f[0], col: f[1] },
  };
}

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
    expect(new Set(reversed.map(cellKey))).toEqual(
      new Set(forward.map(cellKey)),
    );
  });

  it("단일 셀 범위는 셀 1개", () => {
    const cells = cellsInRange({
      anchor: { row: 0, col: 0 },
      focus: { row: 0, col: 0 },
    });
    expect(cells).toEqual([{ row: 0, col: 0 }]);
  });
});

describe("X3 rangeOverlaps", () => {
  it("완전히 분리된 범위는 겹치지 않는다", () => {
    // A1:B2 (0,0)-(1,1) 과 C3:D4 (2,2)-(3,3)
    expect(rangeOverlaps(range([0, 0], [1, 1]), range([2, 2], [3, 3]))).toBe(
      false,
    );
  });

  it("대각으로 인접하기만 하면(모서리도 공유 안 함) 겹치지 않는다", () => {
    // A1:B2 와 C3:D4 — B2(1,1)과 C3(2,2)는 대각 인접, 공유 셀 없음
    expect(rangeOverlaps(range([0, 0], [1, 1]), range([2, 2], [3, 3]))).toBe(
      false,
    );
  });

  it("가로로 인접만 하고 겹치지 않으면 false", () => {
    // A1:B2 (col 0~1) 과 C1:D2 (col 2~3)
    expect(rangeOverlaps(range([0, 0], [1, 1]), range([0, 2], [1, 3]))).toBe(
      false,
    );
  });

  it("세로로 인접만 하고 겹치지 않으면 false", () => {
    // A1:B2 (row 0~1) 과 A3:B4 (row 2~3)
    expect(rangeOverlaps(range([0, 0], [1, 1]), range([2, 0], [3, 1]))).toBe(
      false,
    );
  });

  it("한 셀(모서리)을 공유하면 겹친다", () => {
    // A1:B2 (0,0)-(1,1) 과 B2:C3 (1,1)-(2,2) — B2(1,1) 공유
    expect(rangeOverlaps(range([0, 0], [1, 1]), range([1, 1], [2, 2]))).toBe(
      true,
    );
  });

  it("한쪽이 다른 쪽을 완전히 포함하면 겹친다", () => {
    // A1:D4 가 B2:C3 를 포함
    expect(rangeOverlaps(range([0, 0], [3, 3]), range([1, 1], [2, 2]))).toBe(
      true,
    );
    // 반대 순서도 동일
    expect(rangeOverlaps(range([1, 1], [2, 2]), range([0, 0], [3, 3]))).toBe(
      true,
    );
  });

  it("부분적으로 겹치면 true", () => {
    // A1:C3 (0,0)-(2,2) 과 B2:D4 (1,1)-(3,3) — B2:C3 영역 공유
    expect(rangeOverlaps(range([0, 0], [2, 2]), range([1, 1], [3, 3]))).toBe(
      true,
    );
  });

  it("뒤집힌 anchor/focus도 정규화되어 정상 판정한다", () => {
    // 겹치는 두 범위를 anchor/focus 뒤집어 표현
    const a = range([2, 2], [0, 0]); // A1:C3 역방향
    const b = range([3, 3], [1, 1]); // B2:D4 역방향
    expect(rangeOverlaps(a, b)).toBe(true);

    // 분리된 두 범위도 뒤집어도 false
    expect(rangeOverlaps(range([1, 1], [0, 0]), range([3, 3], [2, 2]))).toBe(
      false,
    );
  });

  it("단일 셀 vs 범위 — 포함되면 true, 벗어나면 false", () => {
    const cell = range([1, 1]); // B2 단일 셀
    expect(rangeOverlaps(cell, range([0, 0], [2, 2]))).toBe(true);
    expect(rangeOverlaps(range([0, 0], [2, 2]), cell)).toBe(true);
    expect(rangeOverlaps(cell, range([2, 2], [3, 3]))).toBe(false);
  });

  it("같은 단일 셀끼리는 겹치고, 다른 단일 셀은 안 겹친다", () => {
    expect(rangeOverlaps(range([2, 3]), range([2, 3]))).toBe(true);
    expect(rangeOverlaps(range([2, 3]), range([2, 4]))).toBe(false);
  });
});
