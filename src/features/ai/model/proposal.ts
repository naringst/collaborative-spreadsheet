import type { CellAddress } from "@/features/sheet";

/**
 * generating: 생성 중 — 적용 불가 (A3 "완료 후에만 적용")
 * complete: 응답 완료 — 적용 가능
 * cancelled: 취소·중단 — 확인만 가능, 적용 불가 (D10, 진입은 묶음 2)
 */
export type ProposalStatus = "generating" | "complete" | "cancelled";

export interface ProposalCell {
  addr: CellAddress;
  /** 요청 시점의 셀 값 — 적용 시 현재 값과 비교해 충돌을 판정한다 (X1, 묶음 3) */
  baseValue: string;
  proposedValue: string;
}

export function canApply(status: ProposalStatus): boolean {
  return status === "complete";
}
