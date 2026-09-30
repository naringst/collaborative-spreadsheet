import { describe, expect, it } from "vitest";
import { PARTICIPANT_PALETTE, generateName, pickColor } from "./identity";

describe("D2 참여자 이름", () => {
  it('"형용사 동물" 형태(공백으로 구분된 두 단어)를 반환한다', () => {
    const name = generateName();
    const parts = name.split(" ");
    expect(parts).toHaveLength(2);
    expect(parts[0]?.length).toBeGreaterThan(0);
    expect(parts[1]?.length).toBeGreaterThan(0);
  });

  it("rand를 주입하면 결정적으로 같은 이름을 만든다", () => {
    const fixed = () => 0.42;
    expect(generateName(fixed)).toBe(generateName(fixed));
  });

  it("rand가 0을 반환해도(경계값) 유효한 이름을 만든다", () => {
    const name = generateName(() => 0);
    expect(name.split(" ")).toHaveLength(2);
  });

  it("rand가 1에 가까운 값을 반환해도(경계값) 유효한 이름을 만든다", () => {
    const name = generateName(() => 0.9999999);
    expect(name.split(" ")).toHaveLength(2);
  });

  it("서로 다른 rand 값은 서로 다른 이름을 만들 수 있다", () => {
    const names = new Set([0, 0.3, 0.6, 0.9].map((v) => generateName(() => v)));
    expect(names.size).toBeGreaterThan(1);
  });
});

describe("C4 참여자 색 배정", () => {
  it("팔레트가 비어 있지 않다", () => {
    expect(PARTICIPANT_PALETTE.length).toBeGreaterThan(0);
  });

  it("아무도 색을 쓰지 않으면 팔레트 첫 색을 준다", () => {
    expect(pickColor([])).toBe(PARTICIPANT_PALETTE[0]);
  });

  it("사용 중인 색은 건너뛰고 팔레트 순서상 첫 미사용 색을 준다", () => {
    const used = PARTICIPANT_PALETTE.slice(0, 1);
    expect(pickColor(used)).toBe(PARTICIPANT_PALETTE[1]);
  });

  it("중간 색만 비어 있으면 그 색을 준다", () => {
    if (PARTICIPANT_PALETTE.length < 3) return;
    const used = PARTICIPANT_PALETTE.filter(
      (c) => c !== PARTICIPANT_PALETTE[1],
    );
    expect(pickColor(used)).toBe(PARTICIPANT_PALETTE[1]);
  });

  it("미사용 색이 하나라도 있으면 사용 중인 색을 주지 않는다", () => {
    const used = PARTICIPANT_PALETTE.slice(0, PARTICIPANT_PALETTE.length - 1);
    const picked = pickColor(used);
    expect(used).not.toContain(picked);
    expect(PARTICIPANT_PALETTE).toContain(picked);
  });

  it("모두 사용 중이면 가장 적게 쓰인 색을 준다", () => {
    // palette[0]만 두 번, 나머지는 한 번씩 사용 중
    const used = [...PARTICIPANT_PALETTE.slice(0, 1), ...PARTICIPANT_PALETTE];
    const picked = pickColor(used);
    expect(PARTICIPANT_PALETTE).toContain(picked);
    expect(picked).not.toBe(PARTICIPANT_PALETTE[0]);
  });

  it("가장 적게 쓰인 색이 여럿이어도 결정적이다 (같은 입력 → 같은 출력)", () => {
    const used = [...PARTICIPANT_PALETTE];
    expect(pickColor(used)).toBe(pickColor(used));
  });

  it("팔레트에 없는 색이 usedColors에 섞여 있어도 팔레트 안에서 고른다", () => {
    const picked = pickColor(["#not-in-palette"]);
    expect(PARTICIPANT_PALETTE).toContain(picked);
  });
});
