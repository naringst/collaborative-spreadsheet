import { describe, expect, it } from "vitest";
import { buildSystemPrompt, describeLabel, renderSheetTable } from "./prompt";

describe("D9 renderSheetTable — 값 영역을 행 단위 표로", () => {
  it("bounding box 안의 빈 셀은 · 로 자리를 차지한다", () => {
    const table = renderSheetTable([
      { cell: "B2", value: "x", formats: [] },
      { cell: "D3", value: "y", formats: [] },
    ]);
    expect(table.split("\n")).toEqual([
      "     | B(col 1) | C(col 2) | D(col 3)",
      '행2(row 1) | "x" | · | ·',
      '행3(row 2) | · | · | "y"',
    ]);
  });

  it("빈 시트면 빈 문자열", () => {
    expect(renderSheetTable([])).toBe("");
  });

  it("Z100 한 칸이면 1×1 표", () => {
    expect(
      renderSheetTable([{ cell: "Z100", value: "end", formats: [] }]),
    ).toBe('     | Z(col 25)\n행100(row 99) | "end"');
  });
});

describe("describeLabel — A1 표기에 0-based 좌표를 덧붙인다", () => {
  it("단일 셀", () => {
    expect(describeLabel("B2")).toBe("B2(row 1, col 1)");
  });
  it("범위", () => {
    expect(describeLabel("B2:D10")).toBe("B2(row 1, col 1):D10(row 9, col 3)");
  });
});

describe("buildSystemPrompt", () => {
  const ctx = {
    cells: [{ cell: "A1", value: "a", formats: [] }],
    selection: "B2:C3",
    activeCell: "B2",
  };
  it("범위 지정이면 그 범위를 좌표와 함께 명시한다 (D8)", () => {
    const p = buildSystemPrompt(ctx, "B2:C3");
    expect(p).toContain("편집 대상은 B2(row 1, col 1):C3(row 2, col 2) 범위다");
    expect(p).toContain('행1(row 0) | "a"');
  });
  it("범위가 없으면 시트 전체", () => {
    expect(buildSystemPrompt(ctx, null)).toContain("시트 전체를 대상으로 한다");
  });
});
