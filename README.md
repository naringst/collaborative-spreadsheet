# Collaborative Spreadsheet

같은 브라우저의 여러 탭에서 동시에 편집하고, AI에게 편집을 요청할 수 있는 웹 스프레드시트입니다.

## 실행 방법

요구 사항: Node.js 20.9 이상 (`.nvmrc` 참고), pnpm

```bash
pnpm install
pnpm dev
```

| 스크립트                    | 설명                            |
| --------------------------- | ------------------------------- |
| `pnpm dev`                  | 개발 서버                       |
| `pnpm build` / `pnpm start` | 프로덕션 빌드 / 실행            |
| `pnpm lint`                 | ESLint (feature 경계 규칙 포함) |
| `pnpm typecheck`            | TypeScript 타입 검사            |
| `pnpm test`                 | Vitest 단위 테스트              |
| `pnpm format`               | Prettier 포맷                   |

## 구현 범위

<!-- 구현한 것 / 의도적으로 제외한 것과 이유 -->

## 아키텍처

### 폴더 구조

```
src/
  app/                 # 라우트만
  features/
    sheet/             # 데이터 모델(model), Y.Doc 구조·편집 연산·undo(store), 그리드 UI(ui)
    collab/            # IndexedDB 영속화, BroadcastChannel 동기화, presence
    ai/                # (3단계) AI 편집
  session/             # 기능 조립 (Y.Doc·저장·동기화·undo 생성과 해제)
  shared/              # 기능과 무관한 공통 UI·유틸
```

의존 방향: `ai → sheet ← collab`, 조립은 `session`에서만 합니다. 각 feature는 `index.ts`로만 외부에 공개되며 ESLint로 강제합니다.

### 동기화 구조

<!-- Yjs + y-indexeddb + BroadcastChannel provider -->

## 설계 결정

<!-- 기술 선택과 이유 (예: BroadcastChannel vs SharedWorker, IndexedDB를 쓴 이유) -->

## 공동 편집과 AI가 만나는 지점

### AI가 결과를 만드는 동안 다른 참여자가 대상 셀·범위를 수정하거나 삭제하면

### 한 사람이 AI 결과를 검토하고 있을 때 다른 참여자에게 보이는 것

### 두 사람이 겹치는 범위에 동시에 AI 편집을 요청하면

## 실제 네트워크 기반 동기화로 확장한다면

<!-- 바꿔야 하는 것 / 그대로 두는 것 -->
