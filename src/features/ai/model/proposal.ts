import type { CellAddress } from "@/features/sheet";

/**
 * generating: 생성 중 — 적용 불가 (A3 "완료 후에만 적용")
 * complete: 응답 완료 — 적용 가능
 * cancelled: 사용자 취소 — 확인만 가능, 적용 불가 (D10)
 * error: 생성 실패·중단 — 확인만 가능, 적용 불가. error 종류를 함께 전달 (A6)
 */
export type ProposalStatus = "generating" | "complete" | "cancelled" | "error";

/**
 * LLM 편집 실패 종류 (A6 "실패 종류를 구분해 안내").
 * credit: 선불 크레딧 소진 402 — 지출 상한 초과 (A7/D11)
 * schema: 응답이 스키마와 달라 쓸 수 없음 (A6 P1)
 */
export type AiErrorKind =
  "network" | "timeout" | "rate-limit" | "credit" | "server" | "schema";

/** 분류된 실패. 소스가 throw하고 store가 세션 error로 표면화한다 (A6) */
export class AiError extends Error {
  constructor(readonly kind: AiErrorKind) {
    super(kind);
    this.name = "AiError";
  }
}

const MESSAGES: Record<AiErrorKind, string> = {
  network: "네트워크 오류로 연결하지 못했습니다. 다시 시도해 주세요.",
  timeout: "응답이 너무 오래 걸립니다. 다시 시도해 주세요.",
  "rate-limit": "요청이 많아 잠시 후 다시 시도해 주세요.",
  credit: "AI 사용 한도를 초과했습니다. 크레딧을 확인해 주세요.",
  server: "AI 서버 오류가 발생했습니다. 다시 시도해 주세요.",
  schema: "응답 형식이 올바르지 않습니다. 다시 시도해 주세요.",
};

export function aiErrorMessage(kind: AiErrorKind): string {
  return MESSAGES[kind];
}

/**
 * 충돌 셀의 선택 (X1). 명세대로 원래값·현재값·AI값 중 고른다.
 * - keep: 현재 값 유지(덮어쓰지 않음) — 기본. 다른 참여자 편집을 보존한다.
 * - base: 요청 시점의 원래 값으로 되돌린다.
 * - ai: AI 제안 값으로 덮어쓴다.
 */
export type CellResolution = "keep" | "base" | "ai";

export interface ProposalCell {
  addr: CellAddress;
  /** 요청 시점의 셀 값 — 현재 값과 비교해 충돌을 판정한다 (X1) */
  baseValue: string;
  proposedValue: string;
  /** 현재 시트 값. store가 원격 변경마다 갱신한다 (X1 실시간) */
  currentValue: string;
  /** currentValue ≠ baseValue — 요청 후 다른 참여자가 바꿨다 (X1) */
  conflict: boolean;
  /** 충돌 셀에만 의미. 사용자가 고른다. 비충돌 셀은 항상 AI 값 적용 */
  resolution: CellResolution;
}

export function canApply(status: ProposalStatus): boolean {
  return status === "complete";
}
