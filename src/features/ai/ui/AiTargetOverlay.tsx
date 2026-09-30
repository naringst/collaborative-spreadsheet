"use client";

import { useSyncExternalStore } from "react";
import { cellKey, cellRect } from "@/features/sheet";
import type { ProposalStore } from "../store/proposal-store";

/**
 * 제안 대상 셀을 그리드 위에 강조한다 (A3 "어디가 바뀔지"). 셀 값 자체는
 * 적용 전까지 바뀌지 않으므로 강조만 얹는다. Grid의 overlay 자리에 주입된다.
 */
export function AiTargetOverlay({
  proposalStore,
}: {
  proposalStore: ProposalStore;
}) {
  const session = useSyncExternalStore(
    proposalStore.subscribe,
    proposalStore.getSession,
    () => null,
  );

  if (!session) return null;

  return (
    <>
      {session.cells.map((cell) => {
        const rect = cellRect(cell.addr.row, cell.addr.col);
        return (
          <div
            key={cellKey(cell.addr)}
            className="pointer-events-none absolute z-[4] border-2 border-dashed border-blue-500 bg-blue-500/10"
            style={rect}
          />
        );
      })}
    </>
  );
}
