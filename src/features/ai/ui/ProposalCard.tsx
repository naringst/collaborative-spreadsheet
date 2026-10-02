"use client";

import { useEffect, useState } from "react";
import { cellKey, cellLabel, type CellAddress } from "@/features/sheet";
import {
  aiErrorMessage,
  canApply,
  type CellResolution,
  type ProposalCell,
} from "../model/proposal";
import type { ProposalSession } from "../store/proposal-store";

/** 현재 세션의 제안 카드: 진행 상태, 셀 diff, 적용·버리기·취소·재시도 (A3·A4·A6) */
export function ProposalCard({
  session,
  onApply,
  onDiscard,
  onCancel,
  onRetry,
  onSetResolution,
}: {
  session: ProposalSession;
  onApply(): void;
  onDiscard(): void;
  onCancel(): void;
  onRetry(): void;
  onSetResolution(addr: CellAddress, resolution: CellResolution): void;
}) {
  const SECONDARY =
    "h-7 flex-1 rounded-md border border-line-2 px-2 text-[12px] text-ink-2 hover:bg-surface-3";
  const PRIMARY =
    "h-7 flex-1 rounded-md bg-ink px-2 text-[12px] font-medium text-surface disabled:opacity-40";

  const conflictCount = session.cells.filter((c) => c.conflict).length;

  return (
    <div className="border-line flex max-w-[94%] flex-col gap-2 self-start rounded-lg rounded-bl-sm border p-2.5">
      {session.status === "generating" && (
        <GeneratingNotice hasCells={session.cells.length > 0} />
      )}
      {session.status === "complete" && (
        <p className="text-ink-2">
          {session.cells.length === 0
            ? "바꿀 셀을 찾지 못했습니다."
            : `${session.cells.length}개 셀을 바꾸겠습니다. 확인 후 적용하세요.`}
        </p>
      )}
      {session.status === "cancelled" && (
        <p className="text-ink-3">취소됨 — 부분 결과는 적용할 수 없습니다.</p>
      )}
      {session.status === "error" && (
        <p className="text-danger">
          {aiErrorMessage(session.error ?? "server")}
        </p>
      )}

      {/* 검토 중 다른 참여자가 대상 셀을 바꾸면 충돌로 안내한다 (X1) */}
      {canApply(session.status) && conflictCount > 0 && (
        <p className="text-danger text-[12px]">
          {conflictCount}개 셀을 그새 다른 참여자가 바꿨습니다. 기본은 그 값을
          유지하며, 셀마다 선택할 수 있습니다.
        </p>
      )}

      {session.cells.length > 0 && (
        <ul className="flex flex-col gap-1">
          {session.cells.map((cell) =>
            cell.conflict ? (
              <ConflictRow
                key={cellKey(cell.addr)}
                cell={cell}
                onSetResolution={onSetResolution}
              />
            ) : (
              <li
                key={cellKey(cell.addr)}
                className="bg-surface-2 flex items-baseline gap-2 rounded-md px-2 py-1"
              >
                <span className="text-ink-3 w-8 shrink-0 font-mono text-[11px]">
                  {cellLabel(cell.addr)}
                </span>
                <span className="text-ink-3 min-w-0 truncate line-through">
                  {cell.baseValue || "(빈 셀)"}
                </span>
                <span className="text-ink-3 shrink-0">→</span>
                <span className="text-ink min-w-0 truncate font-medium">
                  {cell.proposedValue}
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      {session.status === "generating" && (
        <button type="button" className={SECONDARY} onClick={onCancel}>
          취소
        </button>
      )}
      {canApply(session.status) && (
        <div className="flex gap-2">
          <button
            type="button"
            className={PRIMARY}
            disabled={session.cells.length === 0}
            onClick={onApply}
          >
            적용
          </button>
          <button type="button" className={SECONDARY} onClick={onDiscard}>
            버리기
          </button>
        </div>
      )}
      {(session.status === "error" || session.status === "cancelled") && (
        <div className="flex gap-2">
          <button type="button" className={PRIMARY} onClick={onRetry}>
            재시도
          </button>
          <button type="button" className={SECONDARY} onClick={onDiscard}>
            버리기
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 충돌 셀 한 줄 (X1): 원래값·현재값·AI값을 보여 주고 어느 값을 쓸지 고르게 한다.
 * 기본은 "현재 유지" — 다른 참여자가 직접 한 편집을 조용히 덮지 않는다.
 */
function ConflictRow({
  cell,
  onSetResolution,
}: {
  cell: ProposalCell;
  onSetResolution(addr: CellAddress, resolution: CellResolution): void;
}) {
  // 원래값·현재값·AI값 세 선택지를 나란히 보여 준다 (X1 명세). 기본은 현재 유지.
  const choice = (resolution: CellResolution, label: string, value: string) => {
    const selected = cell.resolution === resolution;
    return (
      <button
        type="button"
        onClick={() => onSetResolution(cell.addr, resolution)}
        aria-pressed={selected}
        className={`flex items-center gap-2 rounded-md border px-2 py-1 text-left ${
          selected
            ? "border-accent bg-accent-soft"
            : "border-line-2 hover:bg-surface-3"
        }`}
      >
        <span
          className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${
            selected ? "border-accent" : "border-line-2"
          }`}
        >
          {selected && <span className="bg-accent h-2 w-2 rounded-full" />}
        </span>
        <span className="text-ink-3 w-12 shrink-0 text-[11px]">{label}</span>
        <span className="text-ink min-w-0 flex-1 truncate text-[12px]">
          {value || "(빈 셀)"}
        </span>
      </button>
    );
  };
  return (
    <li className="border-danger/40 bg-danger/5 flex flex-col gap-1.5 rounded-md border px-2 py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-ink-3 font-mono text-[11px]">
          {cellLabel(cell.addr)}
        </span>
        <span className="text-danger text-[10px]">
          다른 참여자가 바꿈 — 적용할 값을 고르세요
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {choice("base", "원래값", cell.baseValue)}
        {choice("keep", "현재값", cell.currentValue)}
        {choice("ai", "AI값", cell.proposedValue)}
      </div>
    </li>
  );
}

/**
 * 생성 중 경과 시간을 보여 줘, 첫 결과가 늦을 때 멈춘 게 아님을 알린다 (A6).
 * generating 동안만 마운트되므로 마운트 시점이 곧 요청 시작이다.
 */
function GeneratingNotice({ hasCells }: { hasCells: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="text-ink-3 inline-flex items-center gap-1.5">
      <span className="bg-accent h-1.5 w-1.5 animate-pulse rounded-full" />
      {hasCells ? "생성 중" : "응답 기다리는 중"}… ({elapsed}s)
    </p>
  );
}
