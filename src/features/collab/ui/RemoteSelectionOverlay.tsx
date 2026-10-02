"use client";

import { useSyncExternalStore } from "react";
import { cellRect, normalizeRange, type GridCursor } from "@/features/sheet";
import { EMPTY_PARTICIPANTS, type Presence } from "../presence";
import { isCellAddress } from "./payload-guards";
import { PeerBadge } from "./PeerBadge";

/** awareness cursor 페이로드의 구체 타입 — collab 코어는 이 모양을 모른다 */
export type SheetCursor = GridCursor;

// anchor·focus 네 값을 전부 검증한다 — 스키마가 다른 탭(구버전 배포)이 보낸
// 페이로드 하나로 오버레이 전체가 렌더 중 throw하지 않게
function isSheetCursor(cursor: unknown): cursor is SheetCursor {
  if (typeof cursor !== "object" || cursor === null) return false;
  const c = cursor as { range?: { anchor?: unknown; focus?: unknown } };
  return isCellAddress(c.range?.anchor) && isCellAddress(c.range?.focus);
}

/** 다른 참여자의 선택 범위·활성 셀·편집 중 표시 (C5). Grid의 overlay 자리에 들어간다. */
export function RemoteSelectionOverlay({ presence }: { presence: Presence }) {
  const participants = useSyncExternalStore(
    presence.subscribe,
    presence.getParticipants,
    () => EMPTY_PARTICIPANTS,
  );

  // 같은 활성 셀을 선택한 참여자의 라벨을 위로 쌓아 겹침을 피한다 (C5 P1)
  const labelStack = new Map<string, number>();

  return (
    <>
      {participants.map((p) => {
        const cursor = p.cursor;
        if (p.isLocal || !isSheetCursor(cursor)) return null;

        const norm = normalizeRange(cursor.range);
        const rangeBox = cellRect(norm.top, norm.left, norm.bottom, norm.right);
        const { anchor } = cursor.range;
        const activeBox = cellRect(anchor.row, anchor.col);
        const isEditing = cursor.editing !== null;

        const anchorKey = `${anchor.row}:${anchor.col}`;
        const stackIndex = labelStack.get(anchorKey) ?? 0;
        labelStack.set(anchorKey, stackIndex + 1);

        return (
          <div
            key={p.clientId}
            className="pointer-events-none absolute inset-0 z-[4]"
          >
            <div
              className="absolute border"
              style={{
                ...rangeBox,
                borderColor: p.color,
                backgroundColor: `color-mix(in srgb, ${p.color} 6%, transparent)`,
              }}
            />
            <div
              className="absolute"
              style={{
                ...activeBox,
                border: `${isEditing ? 3 : 2}px ${isEditing ? "dashed" : "solid"} ${p.color}`,
              }}
            />
            <PeerBadge
              left={activeBox.left}
              // 0행은 위 공간이 sticky 열 헤더에 가리므로 셀 아래에 표시한다
              top={
                anchor.row === 0
                  ? activeBox.top + activeBox.height + 16 * stackIndex
                  : activeBox.top - 16 * (stackIndex + 1)
              }
              color={p.color}
              label={`${p.name}${isEditing ? " · 입력 중" : ""}`}
            />
          </div>
        );
      })}
    </>
  );
}
