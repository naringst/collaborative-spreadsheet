"use client";

import { useSyncExternalStore } from "react";
import { EMPTY_PARTICIPANTS, type Presence } from "../presence/presence";

/**
 * 접속 중 참여자를 겹친 아바타(이름 첫 글자)로 보여 준다 (C4).
 * 전체 이름은 hover 툴팁으로, 나는 우하단 점으로 구분한다.
 */
export function ParticipantList({ presence }: { presence: Presence }) {
  const participants = useSyncExternalStore(
    presence.subscribe,
    presence.getParticipants,
    () => EMPTY_PARTICIPANTS,
  );

  return (
    <ul className="flex items-center" aria-label="참여자">
      {participants.map((p) => (
        <li
          key={p.clientId}
          className="border-surface relative -ml-1.5 flex h-6.5 w-6.5 items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white first:ml-0"
          style={{ backgroundColor: p.color }}
          title={p.isLocal ? `${p.name} (나)` : p.name}
        >
          {p.name.slice(0, 1)}
          {p.isLocal && (
            <span
              aria-hidden
              className="border-surface bg-ink absolute -right-px -bottom-px h-2 w-2 rounded-full border-2"
            />
          )}
        </li>
      ))}
    </ul>
  );
}
