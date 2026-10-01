import { describe, expect, it } from "vitest";
import { createChangesExtractor } from "./stream-extract";

/** 문자열을 임의 경계로 쪼개 순서대로 push하고, 반환된 객체들을 모은다 */
function pushChunks(chunks: string[]): unknown[] {
  const extractor = createChangesExtractor();
  const out: unknown[] = [];
  for (const chunk of chunks) out.push(...extractor.push(chunk));
  return out;
}

/** 문자 단위로 쪼갠다 */
function chars(s: string): string[] {
  return [...s];
}

describe("A4 stream-extract — 증분 JSON 추출", () => {
  it("완전한 JSON을 한 번에 push하면 객체들이 순서대로 나온다", () => {
    const json =
      '{"changes":[{"row":0,"col":0,"value":"a"},{"row":1,"col":1,"value":"b"}]}';
    const out = pushChunks([json]);
    expect(out).toEqual([
      { row: 0, col: 0, value: "a" },
      { row: 1, col: 1, value: "b" },
    ]);
  });

  it("문자 단위로 쪼개도 같은 객체가 같은 순서로 나온다", () => {
    const json =
      '{"changes":[{"row":0,"col":0,"value":"a"},{"row":1,"col":1,"value":"b"}]}';
    const out = pushChunks(chars(json));
    expect(out).toEqual([
      { row: 0, col: 0, value: "a" },
      { row: 1, col: 1, value: "b" },
    ]);
  });

  it("임의 경계로 쪼개도 결과가 같다", () => {
    const json =
      '{"changes":[{"row":2,"col":3,"value":"x"},{"row":4,"col":5,"value":"y"}]}';
    const whole = pushChunks([json]);
    const split = pushChunks([
      '{"chan',
      'ges":[{"row":2,',
      '"col":3,"value":"x"}',
      ',{"row":4,"col"',
      ':5,"value":"y"}]}',
    ]);
    expect(split).toEqual(whole);
  });

  it("객체는 닫히는 push에서만 반환된다 (미완성 push에서는 안 나옴)", () => {
    const extractor = createChangesExtractor();
    expect(extractor.push('{"changes":[{"row":0,"col":0,')).toEqual([]);
    expect(extractor.push('"value":"a"}')).toEqual([
      { row: 0, col: 0, value: "a" },
    ]);
  });

  it("문자열 값 안의 중괄호·대괄호·이스케이프 따옴표를 구조로 오인하지 않는다", () => {
    const json = '{"changes":[{"row":0,"col":0,"value":"a{b}[c] \\"q\\" d"}]}';
    const out = pushChunks([json]);
    expect(out).toEqual([{ row: 0, col: 0, value: 'a{b}[c] "q" d' }]);
  });

  it("문자 단위로 쪼개도 문자열 안 특수문자를 오인하지 않는다", () => {
    const json =
      '{"changes":[{"row":0,"col":0,"value":"a{b}[c] \\"q\\" d"},{"row":1,"col":1,"value":"]}"}]}';
    const out = pushChunks(chars(json));
    expect(out).toEqual([
      { row: 0, col: 0, value: 'a{b}[c] "q" d' },
      { row: 1, col: 1, value: "]}" },
    ]);
  });

  it("중첩 객체는 최상위 객체가 닫힐 때 통째로 한 번 반환된다", () => {
    const json =
      '{"changes":[{"row":0,"col":0,"value":"a","meta":{"k":{"deep":1}}}]}';
    const out = pushChunks(chars(json));
    expect(out).toEqual([
      { row: 0, col: 0, value: "a", meta: { k: { deep: 1 } } },
    ]);
  });

  it("배열이 ] 로 닫힌 뒤의 입력은 무시된다", () => {
    const extractor = createChangesExtractor();
    const first = extractor.push('{"changes":[{"row":0,"col":0,"value":"a"}]}');
    expect(first).toEqual([{ row: 0, col: 0, value: "a" }]);
    // 배열이 닫힌 뒤 또 다른 객체가 오더라도 반환하지 않는다
    expect(extractor.push('{"row":9,"col":9,"value":"z"}')).toEqual([]);
  });

  it("빈 배열이면 아무것도 반환하지 않는다", () => {
    expect(pushChunks(['{"changes":[]}'])).toEqual([]);
    expect(pushChunks(chars('{"changes":[]}'))).toEqual([]);
  });

  it("완성됐지만 깨진 JSON 객체는 건너뛰고 예외를 던지지 않는다", () => {
    // 두 번째 객체는 잘못된 토큰이 들어 있어 JSON.parse가 실패한다
    const json =
      '{"changes":[{"row":0,"col":0,"value":"ok"},{bad},{"row":1,"col":1,"value":"ok2"}]}';
    let out: unknown[] = [];
    expect(() => {
      out = pushChunks(chars(json));
    }).not.toThrow();
    // 깨진 객체는 빠지고 정상 객체는 보존된다
    expect(out).toContainEqual({ row: 0, col: 0, value: "ok" });
    expect(out).toContainEqual({ row: 1, col: 1, value: "ok2" });
  });
});
