---
name: project-conventions
description: 이 저장소의 폴더 구조, 의존 방향, Yjs·React 사용 규칙. 코드를 작성·수정·리뷰하기 전에 항상 읽는다.
---

# 프로젝트 규칙

기준 문서: `docs/spec.md`(무엇을), `README.md` "기술 선택 이유"(왜). 이 스킬은 **어떻게**를 정한다. 셋이 충돌하면 `docs/spec.md`가 우선이다.

## 폴더와 책임

| 위치                        | 책임                                                         | 넣지 않는 것               |
| --------------------------- | ------------------------------------------------------------ | -------------------------- |
| `src/app/`                  | 라우트, 레이아웃, Route Handler                              | 로직, 상태                 |
| `src/features/sheet/model/` | 셀 주소·범위·셀 타입 등 순수 함수                            | React, Yjs, 브라우저 API   |
| `src/features/sheet/store/` | Y.Doc 안의 데이터 구조, 편집 연산(ops), UndoManager          | React, 전송·저장           |
| `src/features/sheet/ui/`    | Grid, Cell, Toolbar, 선택·키보드·편집 모드                   | Yjs 직접 접근              |
| `src/features/collab/`      | y-indexeddb, BroadcastChannel provider, awareness            | 셀·시트 개념               |
| `src/features/sheet-list/`  | 시트 목록(id·이름·생성시각) Y.Doc 구조와 ops, 목록 UI        | 셀 개념, 라우팅·세션 조립  |
| `src/features/collab/ui/`   | 참여자 목록, 다른 참여자 선택 오버레이                       | Yjs 문서 수정              |
| `src/features/ai/`          | (3단계) 스키마, diff·충돌 판정, 스트리밍 클라이언트, AI 패널 | 시트 직접 수정 (ops 사용)  |
| `src/session/`              | Y.Doc·저장·동기화·undo 생성과 해제, Context 제공             | 기능 로직                  |
| `src/shared/`               | 기능과 무관한 공통 UI·유틸                                   | 특정 feature에 속하는 코드 |

## 의존 방향 (ESLint로 강제)

```
ai ──→ sheet ←── collab/ui
         ↑
      session (조립)
```

- 다른 feature는 `@/features/<name>`(index.ts)으로만 import한다. 내부 파일은 feature 안에서 상대 경로로만.
- `sheet`는 `collab`·`ai`·`session`을 모른다. `collab` 코어는 `sheet`를 모른다.
- feature 사이의 연결은 `session`에서만 한다.
- 그리드 위 표시(다른 참여자 선택, AI 대상 범위)는 `Grid`의 overlay 자리에 각 feature가 레이어로 끼워 넣는다. `Grid`가 이들을 import하지 않는다.

## 상태는 한 곳에만

| 상태                                          | 위치                                       |
| --------------------------------------------- | ------------------------------------------ |
| 셀 값·서식, 시트 목록                         | Y.Doc                                      |
| 참여자 이름·색·선택·편집 중 표시·AI 작업 표시 | awareness (저장 안 함)                     |
| 내 선택 범위, 편집 모드, 입력 중 텍스트       | React state (필요한 것만 awareness에 복사) |
| AI 제안, base 스냅샷                          | AI feature 로컬 상태 (Y.Doc에 넣지 않음)   |

## Yjs 규칙

- 셀: 평탄화된 단일 맵 `cells: Y.Map<"r:c:속성", 값>`. 값은 `"r:c:v"`, 서식은 `"r:c:bold"`처럼 셀 주소와 속성을 키 하나에 넣는다. 중첩 Y.Map을 쓰지 않는다 — 두 탭이 같은 빈 셀에 동시에 값·서식을 넣을 때 컨테이너가 LWW로 교체되어 한쪽이 소실되는 문제를 원천 차단한다 (이유: README "셀 저장 구조"). 셀 전체를 일반 객체 하나로 `set`하지 않는다.
- 모든 로컬 편집은 `store`의 ops를 통해 `doc.transact(fn, LOCAL_ORIGIN)`으로 실행한다. UI에서 `Y.Map.set`을 직접 호출하지 않는다.
- 원격에서 받은 update는 provider 인스턴스를 origin으로 적용하고(origin이 자신이면 재전송하지 않음), 다시 전송하지 않는다.
- UndoManager는 `trackedOrigins: new Set([LOCAL_ORIGIN])`. 한 번에 되돌려야 하는 작업(AI 적용, 범위 지우기)은 transact 하나로 묶고 앞뒤로 `stopCapturing()`.
- 참여자 ID와 Y.Doc clientID는 탭 로드마다 새로 만든다. sessionStorage에 두지 않는다(탭 복제 시 복사됨).

## React·Next.js 규칙

- Yjs, IndexedDB, BroadcastChannel, Web Locks는 브라우저 전용. `'use client'` 컴포넌트의 effect 안에서만 생성한다.
- 생성한 것은 cleanup에서 반드시 해제한다(`destroy`, `close`, `unobserve`, `removeEventListener`). 개발 모드 StrictMode 이중 마운트에서도 인스턴스가 하나만 남아야 한다.
- 셀 구독은 `useSyncExternalStore`. `getSnapshot`은 원시값이나 캐시된 객체를 반환한다(매번 새 객체 금지).
- Next.js 16 API가 기억과 다르면 `node_modules/next/dist/docs/`를 확인한다 (AGENTS.md).

## 코드 스타일

- 추상화는 두 번째 구현이 실제로 생길 때 만든다. 예외: collab provider 경계.
- 주석은 **왜**를 적는다. 무엇을 하는지만 적는 주석은 쓰지 않는다.
- 사용하지 않는 코드, 주석 처리된 코드, `console.log`를 남기지 않는다.
- `as`, `!`(non-null assertion)는 이유가 주석으로 설명될 때만.
- 파일이 약 200줄을 넘거나 컴포넌트가 여러 역할을 하면 나눌지 검토한다.
