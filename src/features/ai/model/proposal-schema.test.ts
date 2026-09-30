import { describe, expect, it } from "vitest";
import type { CellAddress } from "@/features/sheet";
import type { CellRange } from "@/features/sheet";
import { parseProposalItem } from "./proposal-schema";

// base()가 항상 빈 문자열을 주는 기본 스텁. baseValue 출처 검증에서 교체한다.
const emptyBase = (): string => "";

describe("D8/A6 parseProposalItem — 정상 통과", () => {
  it("{row,col,value} 형식은 ProposalCell로 통과한다", () => {
    const cell = parseProposalItem(
      { row: 2, col: 3, value: "x" },
      emptyBase,
      null,
    );
    expect(cell).not.toBeNull();
    expect(cell?.addr).toEqual({ row: 2, col: 3 });
    expect(cell?.proposedValue).toBe("x");
  });

  it("빈 문자열 value도 유효한 제안이다 (셀 비우기)", () => {
    const cell = parseProposalItem(
      { row: 0, col: 0, value: "" },
      emptyBase,
      null,
    );
    expect(cell).not.toBeNull();
    expect(cell?.proposedValue).toBe("");
  });

  it("경계값 (0,0)과 (99,25)는 통과한다", () => {
    expect(
      parseProposalItem({ row: 0, col: 0, value: "a" }, emptyBase, null),
    ).not.toBeNull();
    expect(
      parseProposalItem({ row: 99, col: 25, value: "z" }, emptyBase, null),
    ).not.toBeNull();
  });
});

describe("D8/A6 parseProposalItem — 형식 불일치 버림", () => {
  it("row가 문자열이면 null", () => {
    expect(
      parseProposalItem({ row: "2", col: 3, value: "x" }, emptyBase, null),
    ).toBeNull();
  });

  it("col이 비정수(소수)면 null", () => {
    expect(
      parseProposalItem({ row: 2, col: 3.5, value: "x" }, emptyBase, null),
    ).toBeNull();
  });

  it("value가 문자열이 아니면(숫자) null", () => {
    expect(
      parseProposalItem({ row: 2, col: 3, value: 5 }, emptyBase, null),
    ).toBeNull();
  });

  it("value가 없으면 null", () => {
    expect(parseProposalItem({ row: 2, col: 3 }, emptyBase, null)).toBeNull();
  });

  it("객체가 아니면(null·문자열·배열) null", () => {
    expect(parseProposalItem(null, emptyBase, null)).toBeNull();
    expect(parseProposalItem("nope", emptyBase, null)).toBeNull();
    expect(parseProposalItem([2, 3, "x"], emptyBase, null)).toBeNull();
  });
});

describe("D8/A6 parseProposalItem — 그리드 범위 밖 버림", () => {
  it("음수 row는 null", () => {
    expect(
      parseProposalItem({ row: -1, col: 0, value: "x" }, emptyBase, null),
    ).toBeNull();
  });

  it("row 100(그리드 밖)은 null", () => {
    expect(
      parseProposalItem({ row: 100, col: 0, value: "x" }, emptyBase, null),
    ).toBeNull();
  });

  it("col 26(그리드 밖)은 null", () => {
    expect(
      parseProposalItem({ row: 0, col: 26, value: "x" }, emptyBase, null),
    ).toBeNull();
  });
});

describe("D8 parseProposalItem — targetRange 지정 시 범위 밖 버림", () => {
  const range: CellRange = {
    anchor: { row: 1, col: 1 },
    focus: { row: 9, col: 3 },
  }; // B2:D10

  it("targetRange 안의 셀은 통과한다", () => {
    const cell = parseProposalItem(
      { row: 5, col: 2, value: "in" },
      emptyBase,
      range,
    );
    expect(cell).not.toBeNull();
    expect(cell?.addr).toEqual({ row: 5, col: 2 });
  });

  it("그리드 안이지만 targetRange 밖인 셀은 null (D8)", () => {
    // (0,0)은 그리드 안이지만 B2:D10 밖
    expect(
      parseProposalItem({ row: 0, col: 0, value: "out" }, emptyBase, range),
    ).toBeNull();
  });

  it("범위 경계 바로 바깥(한 칸)도 null", () => {
    // col 4 (E)는 D10 오른쪽 밖
    expect(
      parseProposalItem({ row: 5, col: 4, value: "out" }, emptyBase, range),
    ).toBeNull();
  });

  it("targetRange가 뒤집혀 있어도 정규화되어 판정한다", () => {
    const flipped: CellRange = {
      anchor: { row: 9, col: 3 },
      focus: { row: 1, col: 1 },
    };
    expect(
      parseProposalItem({ row: 5, col: 2, value: "in" }, emptyBase, flipped),
    ).not.toBeNull();
    expect(
      parseProposalItem({ row: 0, col: 0, value: "out" }, emptyBase, flipped),
    ).toBeNull();
  });

  it("targetRange가 null이면 그리드 전체를 허용한다 (D8 채팅 전체 요청)", () => {
    expect(
      parseProposalItem({ row: 0, col: 0, value: "x" }, emptyBase, null),
    ).not.toBeNull();
  });
});

describe("parseProposalItem — baseValue 출처", () => {
  it("baseValue는 base(addr)에서 온다", () => {
    const base = (a: CellAddress) => `base@${a.row},${a.col}`;
    const cell = parseProposalItem(
      { row: 4, col: 7, value: "new" },
      base,
      null,
    );
    expect(cell?.baseValue).toBe("base@4,7");
  });

  it("base는 통과한 셀의 정확한 주소로 호출된다", () => {
    const seen: CellAddress[] = [];
    const base = (a: CellAddress) => {
      seen.push(a);
      return "";
    };
    parseProposalItem({ row: 3, col: 2, value: "v" }, base, null);
    expect(seen).toEqual([{ row: 3, col: 2 }]);
  });
});
