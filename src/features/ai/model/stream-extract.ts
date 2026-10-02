/**
 * 구조화 출력 스트림에서 완성된 제안 객체를 하나씩 뽑아낸다 (A4).
 *
 * LLM은 스키마에 맞춰 `{"changes":[ {...}, {...} ]}` 하나를 토큰 단위로 흘려보낸다.
 * 전체가 끝나기 전에 패널에 "하나씩" 쌓으려면 배열 안에서 객체가 닫힐 때마다 그
 * 객체 문자열만 떼어 파싱해야 한다. push된 조각을 이어 붙이며 상태를 유지하는
 * 문자 단위 스캐너로, `changes` 배열 안 최상위 객체가 닫힐 때마다 그 객체를 반환한다.
 *
 * 파싱 실패(완성됐지만 잘못된 JSON)한 객체는 건너뛴다 — 항목 단위 검증은 호출측의
 * parseProposalItem이 맡는다. 상위 구조(바깥 {}·"changes" 키 자체)의 형식 오류는
 * 여기서 신경 쓰지 않는다. 첫 번째 `[`를 changes 배열로 본다(스키마상 배열은 하나뿐).
 */
export interface ChangesExtractor {
  /** 조각을 넣고 이번 조각으로 새로 완성된 객체들을 순서대로 반환한다 */
  push(chunk: string): unknown[];
}

export function createChangesExtractor(): ChangesExtractor {
  let started = false; // changes 배열 `[` 안으로 들어왔는가
  let done = false; // 배열이 `]`로 닫혔는가 — 이후 입력은 무시
  let depth = 0; // 현재 객체의 중괄호 깊이 (0이면 객체 바깥)
  let inString = false;
  let escape = false;
  let current = ""; // 수집 중인 객체 문자열

  // 문자열/이스케이프 상태를 한 글자 전진시킨다. 문자열 밖의 구조 문자(괄호 등)면
  // true를 돌려줘 호출측이 괄호로 해석하게 하고, 문자열 안이거나 여는 따옴표면 false.
  // (문자열 안의 `[`·`{`·`}`를 구조로 오인하지 않게 하는 핵심.)
  const isStructural = (ch: string): boolean => {
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      return false;
    }
    if (ch === '"') {
      inString = true;
      return false;
    }
    return true;
  };

  return {
    push(chunk) {
      const out: unknown[] = [];
      if (done) return out;

      for (const ch of chunk) {
        // 1) 배열이 열리기 전: 문자열 밖의 첫 `[`를 찾는다
        if (!started) {
          if (isStructural(ch) && ch === "[") started = true;
          continue;
        }

        // 2) 객체 바깥: 다음 객체의 시작 `{` 또는 배열의 끝 `]`만 본다
        if (depth === 0) {
          if (ch === "{") {
            depth = 1;
            current = "{";
          } else if (ch === "]") {
            done = true;
            break;
          }
          continue;
        }

        // 3) 객체 안: 문자열·중첩 괄호를 추적하다 최상위 `}`에서 객체를 떼어 낸다
        current += ch;
        if (!isStructural(ch)) continue;
        if (ch === "{") {
          depth += 1;
        } else if (ch === "}" && --depth === 0) {
          try {
            out.push(JSON.parse(current));
          } catch {
            // 완성됐지만 깨진 객체는 버린다 (항목 검증은 호출측)
          }
          current = "";
        }
      }

      return out;
    },
  };
}
