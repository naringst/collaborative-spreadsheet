"use client";

import { useState, useSyncExternalStore } from "react";
import {
  cellLabel,
  isSingleCell,
  rangeLabel,
  type GridCursor,
} from "@/features/sheet";
import { canApply } from "../model/proposal";
import type { ProposalStore } from "../store/proposal-store";

interface AiPanelProps {
  proposalStore: ProposalStore;
  /** 현재 선택 — 범위가 지정돼 있으면 요청 대상이 된다 (A2/D8) */
  cursor: GridCursor;
}

/** AI 채팅·제안 검토 패널 (A1·A3) */
export function AiPanel({ proposalStore, cursor }: AiPanelProps) {
  const [prompt, setPrompt] = useState("");
  const session = useSyncExternalStore(
    proposalStore.subscribe,
    proposalStore.getSession,
    () => null,
  );

  // 선택이 여러 셀이면 그 범위가 대상, 단일 셀이면 시트 전체 (D8)
  const hasRange = !isSingleCell(cursor.range);
  const targetChip = hasRange ? rangeLabel(cursor.range) : null;

  const submit = () => {
    if (prompt.trim() === "") return;
    proposalStore.start({
      prompt,
      targetRange: hasRange ? cursor.range : null,
      cursor,
    });
  };

  return (
    <div className="flex h-full w-72 flex-col border-l border-gray-200 text-sm">
      <div className="border-b border-gray-200 px-3 py-2 font-medium">
        AI 편집
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {session === null && (
          <p className="text-gray-500">
            시트를 어떻게 바꿀지 아래에 입력하세요.
          </p>
        )}
        {session?.status === "generating" && (
          <p className="text-gray-500">생성 중…</p>
        )}
        {session && session.cells.length > 0 && (
          <ul className="flex flex-col gap-1">
            {session.cells.map((cell) => (
              <li
                key={cellLabel(cell.addr)}
                className="rounded border border-gray-200 px-2 py-1"
              >
                <span className="font-mono text-xs text-gray-500">
                  {cellLabel(cell.addr)}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 line-through">
                    {cell.baseValue || "(빈 셀)"}
                  </span>
                  <span>→</span>
                  <span className="font-medium">{cell.proposedValue}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {session && canApply(session.status) && (
        <div className="flex gap-2 border-t border-gray-200 p-3">
          <button
            type="button"
            className="flex-1 rounded bg-blue-600 px-2 py-1 text-white disabled:opacity-40"
            disabled={session.cells.length === 0}
            onClick={() => proposalStore.apply()}
          >
            적용
          </button>
          <button
            type="button"
            className="flex-1 rounded border border-gray-300 px-2 py-1"
            onClick={() => proposalStore.discard()}
          >
            버리기
          </button>
        </div>
      )}

      <div className="border-t border-gray-200 p-3">
        {targetChip && (
          <div className="mb-1 inline-block rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-800">
            {targetChip}
          </div>
        )}
        <textarea
          className="w-full resize-none rounded border border-gray-300 p-1.5 focus:border-gray-400 focus:outline-none"
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="예: B열을 모두 대문자로"
        />
      </div>
    </div>
  );
}
