"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isSingleCell, rangeLabel, type GridCursor } from "@/features/sheet";
import { SparkIcon } from "@/shared/ui/icons";
import type { ProposalSession, ProposalStore } from "../store/proposal-store";
import { ProposalCard } from "./ProposalCard";

interface AiPanelProps {
  proposalStore: ProposalStore;
  /** 현재 선택 — 범위가 지정돼 있으면 요청 대상이 된다 (A2/D8) */
  cursor: GridCursor;
  /** 다른 참여자가 겹치는 범위에서 AI 작업 중이면 경고 문구 (X3) */
  overlapWarning: string | null;
  onClose(): void;
}

type TurnOutcome = "applied" | "discarded" | "cancelled" | "error";

/** 끝난 요청 한 건의 요약 — 대화창에 남겨 흐름을 보여 준다 */
interface PastTurn {
  id: number;
  prompt: string;
  targetLabel: string | null;
  cellCount: number;
  outcome: TurnOutcome;
}

const OUTCOME_LABEL: Record<TurnOutcome, string> = {
  applied: "적용됨",
  discarded: "버림",
  cancelled: "취소됨",
  error: "실패",
};

const EXAMPLE_PROMPTS = [
  "B열을 모두 대문자로",
  "빈 셀을 0으로 채워줘",
  "1행을 굵게",
];

/** AI 채팅·제안 검토 패널 (A1·A3) */
export function AiPanel({
  proposalStore,
  cursor,
  overlapWarning,
  onClose,
}: AiPanelProps) {
  const [prompt, setPrompt] = useState("");
  // 지난 요청은 UI에만 남긴다 — 제안 상태의 원본은 store의 현재 세션 하나다
  const [history, setHistory] = useState<PastTurn[]>([]);
  const session = useSyncExternalStore(
    proposalStore.subscribe,
    proposalStore.getSession,
    () => null,
  );
  const transcriptRef = useRef<HTMLDivElement>(null);

  // 선택이 여러 셀이면 그 범위가 대상, 단일 셀이면 시트 전체 (D8)
  const hasRange = !isSingleCell(cursor.range);
  const targetChip = hasRange ? rangeLabel(cursor.range) : null;

  // 새 메시지·제안 셀이 쌓이면 끝으로 스크롤한다
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length, session?.cells.length, session?.status]);

  const archive = (s: ProposalSession, outcome: TurnOutcome) => {
    setHistory((h) => [
      ...h,
      {
        id: h.length,
        prompt: s.prompt,
        targetLabel: s.targetRange ? rangeLabel(s.targetRange) : null,
        cellCount: s.cells.length,
        outcome,
      },
    ]);
  };

  const submit = () => {
    const text = prompt.trim();
    if (text === "" || session?.status === "generating") return;
    // 검토 중이던 제안 위에 새 요청을 보내면 그 제안은 버린 것으로 기록한다
    if (session) archive(session, outcomeOf(session.status, "discarded"));
    proposalStore.start({
      prompt: text,
      targetRange: hasRange ? cursor.range : null,
      cursor,
    });
    setPrompt("");
  };

  const isGenerating = session?.status === "generating";

  return (
    <div className="border-line bg-surface flex h-full w-80 shrink-0 flex-col border-l text-[13px]">
      <div className="border-line text-ink flex h-10 items-center justify-between border-b px-3 font-medium">
        <span className="inline-flex items-center gap-1.5">
          <SparkIcon className="text-accent" />
          AI 편집
        </span>
        <button
          type="button"
          className="text-ink-3 hover:bg-surface-3 hover:text-ink grid h-6 w-6 place-items-center rounded-md"
          onClick={onClose}
          aria-label="AI 패널 닫기"
        >
          ×
        </button>
      </div>

      <div
        ref={transcriptRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3"
      >
        {history.length === 0 && session === null && (
          <div className="flex flex-col gap-2">
            <p className="text-ink-2">
              시트를 어떻게 바꿀지 말해 주세요. 여러 셀을 선택해 두면 그 범위만
              대상으로 삼습니다.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="border-line text-ink-2 hover:bg-surface-3 hover:text-ink rounded-full border px-2.5 py-0.5 text-[12px]"
                  onClick={() => setPrompt(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-1.5">
            <UserBubble prompt={turn.prompt} targetLabel={turn.targetLabel} />
            <div className="text-ink-3 self-start text-[12px]">
              {turn.cellCount}개 셀 제안 · {OUTCOME_LABEL[turn.outcome]}
            </div>
          </div>
        ))}

        {session && (
          <div className="flex flex-col gap-1.5">
            <UserBubble
              prompt={session.prompt}
              targetLabel={
                session.targetRange ? rangeLabel(session.targetRange) : null
              }
            />
            <ProposalCard
              session={session}
              onApply={() => {
                archive(session, "applied");
                proposalStore.apply();
              }}
              onDiscard={() => {
                archive(session, outcomeOf(session.status, "discarded"));
                proposalStore.discard();
              }}
              onCancel={() => proposalStore.cancel()}
              onRetry={() => proposalStore.retry()}
              onSetResolution={(addr, resolution) =>
                proposalStore.setResolution(addr, resolution)
              }
            />
          </div>
        )}
      </div>

      <div className="border-line border-t p-3">
        {/* 겹치는 범위에 다른 참여자가 AI 작업 중 — 경고만, 진행은 막지 않는다 (X3) */}
        {overlapWarning && (
          <div className="bg-danger/5 text-danger mb-2 rounded-md px-2 py-1 text-[12px]">
            {overlapWarning}
          </div>
        )}
        <div className="border-line-2 bg-surface-2 focus-within:border-accent flex flex-col gap-1.5 rounded-lg border p-2">
          {targetChip && (
            <div className="bg-accent-soft text-accent self-start rounded-md px-1.5 py-0.5 font-mono text-[11px]">
              {targetChip}
            </div>
          )}
          <textarea
            className="text-ink placeholder:text-ink-3 w-full resize-none bg-transparent focus:outline-none"
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
            placeholder={
              targetChip
                ? "선택 범위를 어떻게 바꿀까요?"
                : "예: B열을 모두 대문자로"
            }
            aria-label="AI에게 보낼 지시"
          />
          <div className="text-ink-3 flex items-center justify-between text-[11px]">
            <span>Enter로 보내기 · Shift+Enter 줄바꿈</span>
            <button
              type="button"
              className="bg-ink text-surface h-7 rounded-md px-2.5 text-[12px] font-medium disabled:opacity-40"
              disabled={prompt.trim() === "" || isGenerating}
              onClick={submit}
            >
              보내기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function outcomeOf(
  status: ProposalSession["status"],
  fallback: TurnOutcome,
): TurnOutcome {
  if (status === "cancelled") return "cancelled";
  if (status === "error") return "error";
  return fallback;
}

function UserBubble({
  prompt,
  targetLabel,
}: {
  prompt: string;
  targetLabel: string | null;
}) {
  return (
    <div className="bg-surface-3 text-ink max-w-[88%] self-end rounded-lg rounded-br-sm px-2.5 py-1.5">
      {targetLabel && (
        <span className="text-accent mr-1.5 font-mono text-[11px]">
          {targetLabel}
        </span>
      )}
      <span className="whitespace-pre-wrap">{prompt}</span>
    </div>
  );
}