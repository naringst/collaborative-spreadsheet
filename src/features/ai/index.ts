/**
 * ai — AI 편집 (제안 생성·검토·적용)
 *
 * - model/ : 제안 타입·상태머신, 스키마·검증, LLM 컨텍스트 구성 (순수)
 * - store/ : 진행 중 제안 세션의 로컬 상태 (Y.Doc에 넣지 않음 — 적용 전 개인 초안)
 * - ui/    : 채팅·검토 패널, 대상 범위 강조 오버레이
 *
 * 의존 규칙: sheet의 공개 API만 사용한다. 시트는 store ops로만 수정한다.
 */
export {
  canApply,
  aiErrorMessage,
  AiError,
  type AiErrorKind,
  type ProposalCell,
  type ProposalStatus,
} from "./model/proposal";
export {
  PROPOSAL_JSON_SCHEMA,
  parseProposalItem,
} from "./model/proposal-schema";
export { createChangesExtractor } from "./model/stream-extract";
export { buildContext, type AiContext } from "./model/context";
export { buildSystemPrompt } from "./model/prompt";
export {
  createProposalStore,
  type ProposalSource,
  type ProposalSession,
  type ProposalStore,
} from "./store/proposal-store";
export { createOpenRouterSource } from "./store/openrouter-source";
// 서버 전용 — Route Handler(app/api/ai/propose)에서만 호출한다
export { createProposalResponse } from "./server/propose";
export { AiPanel } from "./ui/AiPanel";
export { AiTargetOverlay } from "./ui/AiTargetOverlay";
