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

export interface ProposalCell {
  addr: CellAddress;
  /** 요청 시점의 셀 값 — 적용 시 현재 값과 비교해 충돌을 판정한다 (X1, 묶음 3) */
  baseValue: string;
  proposedValue: string;
}

export function canApply(status: ProposalStatus): boolean {
  return status === "complete";
}
