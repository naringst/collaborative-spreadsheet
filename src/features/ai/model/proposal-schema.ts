import {
  GRID_COLS,
  GRID_ROWS,
  rangeContains,
  type CellAddress,
  type CellRange,
} from "@/features/sheet";
import type { ProposalCell } from "./proposal";

/** 구조화 출력 스키마 (묶음 2 Route Handler가 LLM에 전달). 값만 제안한다(서식 제외). */
export const PROPOSAL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["changes"],
  properties: {
    changes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["row", "col", "value"],
        properties: {
          row: { type: "integer", minimum: 0, maximum: GRID_ROWS - 1 },
          col: { type: "integer", minimum: 0, maximum: GRID_COLS - 1 },
          value: { type: "string" },
        },
      },
    },
  },
} as const;

/**
 * 원시 응답 항목 하나를 검증한다. 형식이 맞지 않거나(A6 P1) 대상 범위 밖이면(D8)
 * null을 반환해 호출측이 그 항목만 버린다.
 */
export function parseProposalItem(
  raw: unknown,
  base: (addr: CellAddress) => string,
  targetRange: CellRange | null,
): ProposalCell | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;
  const { row, col, value } = item;
  if (typeof row !== "number" || !Number.isInteger(row)) return null;
  if (typeof col !== "number" || !Number.isInteger(col)) return null;
  if (typeof value !== "string") return null;
  if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return null;

  const addr: CellAddress = { row, col };
  if (targetRange && !rangeContains(targetRange, addr)) return null; // D8

  // 생성 시점엔 현재 값 = base라 충돌 없음. store가 원격 변경마다 갱신한다 (X1).
  const baseValue = base(addr);
  return {
    addr,
    baseValue,
    proposedValue: value,
    currentValue: baseValue,
    conflict: false,
    resolution: "keep",
  };
}
