import { describe, expect, it } from "vitest";
import {
  GRID_COLS,
  GRID_ROWS,
  cellKey,
  columnLabel,
  isNumericValue,
  isSameCell,
  moveWithinGrid,
} from "./cell";

describe("S7 그리드 크기 (D1)", () => {
  it("100행 × 26열 고정", () => {
    expect(GRID_ROWS).toBe(100);
    expect(GRID_COLS).toBe(26);
  });
});

describe("S7 셀 키·라벨", () => {
  it('cellKey는 "r:c" 형식', () => {
    expect(cellKey({ row: 0, col: 0 })).toBe("0:0");
    expect(cellKey({ row: 99, col: 25 })).toBe("99:25");
  });

  it("서로 다른 셀은 서로 다른 키를 가진다", () => {
    // "1:11" vs "11:1" 같은 구분자 없는 충돌 방지
    expect(cellKey({ row: 1, col: 11 })).not.toBe(cellKey({ row: 11, col: 1 }));
  });

  it("columnLabel: 0 → A, 25 → Z", () => {
    expect(columnLabel(0)).toBe("A");
    expect(columnLabel(1)).toBe("B");
    expect(columnLabel(25)).toBe("Z");
  });

});

describe("S3 moveWithinGrid — 시트 가장자리에서 멈춤", () => {
  it("일반 이동", () => {
    expect(moveWithinGrid({ row: 5, col: 5 }, 1, 0)).toEqual({ row: 6, col: 5 });
    expect(moveWithinGrid({ row: 5, col: 5 }, 0, -1)).toEqual({ row: 5, col: 4 });
  });

  it("왼쪽 위 모서리에서 음수 이동은 멈춘다", () => {
    expect(moveWithinGrid({ row: 0, col: 0 }, -1, 0)).toEqual({ row: 0, col: 0 });
    expect(moveWithinGrid({ row: 0, col: 0 }, 0, -1)).toEqual({ row: 0, col: 0 });
  });

  it("오른쪽 아래 모서리에서 양수 이동은 멈춘다", () => {
    expect(moveWithinGrid({ row: GRID_ROWS - 1, col: GRID_COLS - 1 }, 1, 0)).toEqual({
      row: GRID_ROWS - 1,
      col: GRID_COLS - 1,
    });
    expect(moveWithinGrid({ row: GRID_ROWS - 1, col: GRID_COLS - 1 }, 0, 1)).toEqual({
      row: GRID_ROWS - 1,
      col: GRID_COLS - 1,
    });
  });

  it("큰 delta도 시트 안으로 클램프된다", () => {
    expect(moveWithinGrid({ row: 50, col: 10 }, 1000, 1000)).toEqual({
      row: GRID_ROWS - 1,
      col: GRID_COLS - 1,
    });
    expect(moveWithinGrid({ row: 50, col: 10 }, -1000, -1000)).toEqual({ row: 0, col: 0 });
  });

  it("이동 0은 같은 좌표를 반환한다", () => {
    expect(moveWithinGrid({ row: 3, col: 4 }, 0, 0)).toEqual({ row: 3, col: 4 });
  });
});

describe("S1 isSameCell", () => {
  it("같은 좌표면 true", () => {
    expect(isSameCell({ row: 2, col: 3 }, { row: 2, col: 3 })).toBe(true);
  });

  it("행 또는 열이 다르면 false", () => {
    expect(isSameCell({ row: 2, col: 3 }, { row: 3, col: 2 })).toBe(false);
    expect(isSameCell({ row: 2, col: 3 }, { row: 2, col: 4 })).toBe(false);
  });
});

describe("S2 isNumericValue — 숫자 오른쪽 정렬 판정", () => {
  it("정수·소수·음수는 숫자", () => {
    expect(isNumericValue("0")).toBe(true);
    expect(isNumericValue("42")).toBe(true);
    expect(isNumericValue("3.14")).toBe(true);
    expect(isNumericValue("-7")).toBe(true);
  });

  it("빈 문자열·공백은 숫자가 아니다", () => {
    expect(isNumericValue("")).toBe(false);
    expect(isNumericValue(" ")).toBe(false);
    expect(isNumericValue("   ")).toBe(false);
  });

  it("일반 텍스트·혼합 문자열은 숫자가 아니다", () => {
    expect(isNumericValue("abc")).toBe(false);
    expect(isNumericValue("12abc")).toBe(false);
  });
});
