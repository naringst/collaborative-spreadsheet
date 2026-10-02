"use client";

import { useSyncExternalStore } from "react";
import { cellRect, normalizeRange, type CellRange } from "@/features/sheet";
import { EMPTY_PARTICIPANTS, type Presence } from "../presence/presence";
import { isCellAddress } from "./payload-guards";
import { BADGE_LINE_H, PeerBadge } from "./PeerBadge";

/** awareness aiTask 페이로드의 구체 타입 — collab 코어는 이 모양을 모른다 (X2) */
export interface AiTaskPayload {
  /** 대상 범위. null이면 시트 전체 요청 */
  range: CellRange | null;
  phase: "generating" | "reviewing";
}

// 범위가 null(시트 전체)이거나 anchor·focus가 온전한 범위만 통과시킨다 — 구버전
// 탭이 보낸 다른 스키마로 렌더 중 throw하지 않게
export function isAiTaskPayload(task: unknown): task is AiTaskPayload {
  if (typeof task !== "object" || task === null) return false;
  const t = task as { range?: unknown; phase?: unknown };
  if (t.phase !== "generating" && t.phase !== "reviewing") return false;
  if (t.range === null) return true;
  const r = t.range as { anchor?: unknown; focus?: unknown };
  return isCellAddress(r?.anchor) && isCellAddress(r?.focus);
}

/**
 * 다른 참여자가 AI 편집을 생성·검토 중인 범위에 점선 테두리와 배지를 그린다 (X2).
 * 제안 값은 보이지 않고 편집을 막지도 않는다 — 확정 안 된 개인 초안이다.
 * Grid의 overlay 자리에 들어간다.
 */
export function RemoteAiTaskOverlay({ presence }: { presence: Presence }) {
  const participants = useSyncExternalStore(
    presence.subscribe,
    presence.getParticipants,
    () => EMPTY_PARTICIPANTS,
  );

  return (
    <>
      {participants.map((p) => {
        if (p.isLocal || !isAiTaskPayload(p.aiTask)) return null;
        const { range, phase } = p.aiTask;
        const label = `${p.name} · AI ${phase === "generating" ? "생성 중" : "검토 중"}`;
        // 범위가 있으면 테두리, 없으면(시트 전체) 좌상단 배지만
        const norm = range ? normalizeRange(range) : null;
        const box = norm
          ? cellRect(norm.top, norm.left, norm.bottom, norm.right)
          : cellRect(0, 0);

        return (
          <div
            key={p.clientId}
            className="pointer-events-none absolute inset-0 z-[3]"
          >
            {norm && (
              <div
                className="absolute border-2 border-dashed"
                style={{
                  ...box,
                  borderColor: p.color,
                  backgroundColor: `color-mix(in srgb, ${p.color} 5%, transparent)`,
                }}
              />
            )}
            <PeerBadge
              left={box.left}
              top={
                norm && norm.top > 0
                  ? box.top - BADGE_LINE_H
                  : box.top + box.height
              }
              color={p.color}
              label={label}
            />
          </div>
        );
      })}
    </>
  );
}
