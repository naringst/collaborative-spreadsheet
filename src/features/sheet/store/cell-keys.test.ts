import { describe, it, expect } from "vitest";
import { formatKey, styleKey, parseCellKey } from "./cell-keys";
import type { CellAddress } from "../model/cell";
import type { CellFormatName, CellStyleName } from "../model/cell-format";

describe("D4 셀 저장 키 인코딩 — formatKey", () => {
  it("r:c:format 형식으로 인코딩한다", () => {
    expect(formatKey({ row: 2, col: 1 }, "bold")).toBe("2:1:bold");
  });

  it("최소 좌표", () => {
    expect(formatKey({ row: 0, col: 0 }, "italic")).toBe("0:0:italic");
  });

  it("최대 좌표(99,25)", () => {
    expect(formatKey({ row: 99, col: 25 }, "underline")).toBe("99:25:underline");
  });

  it("모든 토글 서식 이름을 그대로 담는다", () => {
    const formats: CellFormatName[] = ["bold", "italic", "underline", "strike"];
    for (const f of formats) {
      expect(formatKey({ row: 5, col: 3 }, f)).toBe(`5:3:${f}`);
    }
  });
});

describe("D4 셀 저장 키 인코딩 — styleKey", () => {
  it("r:c:style 형식으로 인코딩한다", () => {
    expect(styleKey({ row: 0, col: 0 }, "align")).toBe("0:0:align");
  });

  it("size 스타일", () => {
    expect(styleKey({ row: 10, col: 4 }, "size")).toBe("10:4:size");
  });

  it("모든 스타일 이름을 그대로 담는다", () => {
    const styles: CellStyleName[] = ["align", "size"];
    for (const s of styles) {
      expect(styleKey({ row: 99, col: 25 }, s)).toBe(`99:25:${s}`);
    }
  });
});

describe("D4 셀 키 파싱 — parseCellKey 유효 입력", () => {
  it("최소 유효 좌표 0:0", () => {
    expect(parseCellKey("0:0")).toEqual<CellAddress>({ row: 0, col: 0 });
  });

  it("최대 유효 좌표 99:25", () => {
    expect(parseCellKey("99:25")).toEqual<CellAddress>({ row: 99, col: 25 });
  });

  it("중간 좌표", () => {
    expect(parseCellKey("12:7")).toEqual<CellAddress>({ row: 12, col: 7 });
  });

  it("경계 바로 안쪽 row=99, col=0", () => {
    expect(parseCellKey("99:0")).toEqual<CellAddress>({ row: 99, col: 0 });
  });

  it("경계 바로 안쪽 row=0, col=25", () => {
    expect(parseCellKey("0:25")).toEqual<CellAddress>({ row: 0, col: 25 });
  });
});

describe("D4 셀 키 파싱 — parseCellKey 손상된 키는 null", () => {
  it("비정수 소수점 1.5:2", () => {
    expect(parseCellKey("1.5:2")).toBeNull();
  });

  it("비정수 알파벳 a:b", () => {
    expect(parseCellKey("a:b")).toBeNull();
  });

  it("col 토큰이 비어 있음 1:", () => {
    expect(parseCellKey("1:")).toBeNull();
  });

  it("row 토큰이 비어 있음 :1", () => {
    expect(parseCellKey(":1")).toBeNull();
  });

  it("콜론 없음 5", () => {
    expect(parseCellKey("5")).toBeNull();
  });

  it("빈 문자열", () => {
    expect(parseCellKey("")).toBeNull();
  });

  it("row 음수", () => {
    expect(parseCellKey("-1:0")).toBeNull();
  });

  it("col 음수", () => {
    expect(parseCellKey("0:-1")).toBeNull();
  });

  it("row 경계 초과 100", () => {
    expect(parseCellKey("100:0")).toBeNull();
  });

  it("col 경계 초과 26", () => {
    expect(parseCellKey("0:26")).toBeNull();
  });

  it("row 크게 초과", () => {
    expect(parseCellKey("999:0")).toBeNull();
  });
});

describe("D4 셀 키 왕복 — formatKey/styleKey의 r:c 부분을 parseCellKey가 복원", () => {
  // parseCellKey는 "r:c" 2토큰 전제. 저장 키의 앞 두 토큰만 떼어 확인한다.
  const rcOf = (key: string): string => key.split(":").slice(0, 2).join(":");

  it("formatKey의 좌표 부분을 복원한다", () => {
    const addr: CellAddress = { row: 42, col: 13 };
    expect(parseCellKey(rcOf(formatKey(addr, "bold")))).toEqual(addr);
  });

  it("styleKey의 좌표 부분을 복원한다", () => {
    const addr: CellAddress = { row: 7, col: 0 };
    expect(parseCellKey(rcOf(styleKey(addr, "align")))).toEqual(addr);
  });
});
