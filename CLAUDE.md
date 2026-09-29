@AGENTS.md

# collaborative-spreadsheet

탭 간 공동편집과 AI 편집을 지원하는 웹 스프레드시트 (과제).

## 기준 문서

- `docs/spec.md` — 무엇을 만드는가. 명세 ID(S·C·A·X·Q·R·D)의 원본
- `README.md` "기술 선택 이유" — 왜 이렇게 만드는가
- `.claude/skills/project-conventions` — 어떻게 만드는가. **코드를 쓰기 전에 항상 읽는다**

## 작업 흐름

1. 작업할 명세 ID를 정하고 `docs/spec.md`의 해당 항목을 읽는다.
2. 기능 묶음마다 Plan 모드로 설계를 먼저 보여 주고 승인받은 뒤 구현한다.
3. 공개 API가 정해지면 `test-writer`에게 테스트를 맡긴다 (구현을 보여 주지 않는다).
4. 구현 후 `verify` 스킬 절차를 따른다.
5. 기능 묶음이 끝나면 리뷰어를 병렬로 실행한다.
   - 1단계: `spec-reviewer`, `code-reviewer`, `quality-reviewer`
   - 2단계부터: 위 셋 + `collab-reviewer`
6. 리뷰 결과 중 근거가 있는 것만 고친다. `code-reviewer`(방어 코드 추가)와 `quality-reviewer`(단순화)가 충돌하면 명세와 Q 섹션을 기준으로 판단하고 이유를 남긴다.
7. 새 문제가 나오지 않을 때까지 5~6을 반복한다.
8. 설계 결정을 내렸으면 `decision-log` 스킬대로 README에 기록한다.

## 금지

- 명세를 조용히 벗어나는 구현. 바꿔야 하면 `docs/spec.md` 변경을 먼저 제안한다.
- 검사를 통과시키려고 규칙을 끄거나 타입을 우회하는 것.
- 사용자 확인 없이 커밋.
