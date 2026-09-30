import { describe, expect, it } from "vitest";
import type { CellFormatName } from "@/features/sheet";
import type { GridCursor } from "@/features/sheet";
import type { CellSnapshot } from "@/features/sheet";
import { buildContext } from "./context";

function cursor(range: GridCursor["range"]): GridCursor {
  return { range, editing: null };
}

const single = cursor({
  anchor: { row: 1, col: 1 },
  focus: { row: 1, col: 1 },
});

describe("A1/D9 buildContext — 값 있는 셀을 A1 표기로", () => {
  it("스냅샷 셀이 A1 표기·값·서식으로 담긴다", () => {
    const snapshot: CellSnapshot[] = [
      { addr: { row: 0, col: 0 }, value: "a", formats: [] },
      {
        addr: { row: 1, col: 2 },
        value: "b",
        formats: ["bold"] as CellFormatName[],
      },
    ];
    const ctx = buildContext(snapshot, single);
    expect(ctx.cells).toEqual([
      { cell: "A1", value: "a", formats: [] },
      { cell: "C2", value: "b", formats: ["bold"] },
    ]);
  });

  it("빈 스냅샷이면 cells는 빈 배열", () => {
    const ctx = buildContext([], single);
    expect(ctx.cells).toEqual([]);
  });

  it("마지막 셀(99,25)은 Z100으로 표기된다", () => {
    const ctx = buildContext(
      [{ addr: { row: 99, col: 25 }, value: "end", formats: [] }],
      single,
    );
    expect(ctx.cells[0]?.cell).toBe("Z100");
  });
});

describe("A1/D9 buildContext — selection", () => {
  it("단일 셀 선택이면 selection은 그 셀 (D9: 선택 범위 항상 포함)", () => {
    const ctx = buildContext([], single);
    expect(ctx.selection).toBe("B2");
  });

  it("범위 선택이면 selection은 B2:D10", () => {
    const ctx = buildContext(
      [],
      cursor({ anchor: { row: 1, col: 1 }, focus: { row: 9, col: 3 } }),
    );
    expect(ctx.selection).toBe("B2:D10");
  });

  it("뒤집힌 범위도 정규화된 B2:D10", () => {
    const ctx = buildContext(
      [],
      cursor({ anchor: { row: 9, col: 3 }, focus: { row: 1, col: 1 } }),
    );
    expect(ctx.selection).toBe("B2:D10");
  });
});

describe("A1/D9 buildContext — activeCell", () => {
  it("activeCell은 range.anchor의 A1 표기다", () => {
    const ctx = buildContext(
      [],
      cursor({ anchor: { row: 4, col: 0 }, focus: { row: 9, col: 3 } }),
    );
    expect(ctx.activeCell).toBe("A5");
  });

  it("범위가 뒤집혀도 activeCell은 anchor를 따른다 (focus가 아님)", () => {
    // anchor=(9,3)=D10, focus=(1,1)=B2 → activeCell은 D10
    const ctx = buildContext(
      [],
      cursor({ anchor: { row: 9, col: 3 }, focus: { row: 1, col: 1 } }),
    );
    expect(ctx.activeCell).toBe("D10");
  });
});
