"use client";

import { useSyncExternalStore } from "react";
import type { Presence } from "../presence";

/** 접속 중 참여자 목록. 내 이름은 바로 수정할 수 있다 (C4). */
const NO_PARTICIPANTS: never[] = [];

export function ParticipantList({ presence }: { presence: Presence }) {
  const participants = useSyncExternalStore(
    presence.subscribe,
    presence.getParticipants,
    () => NO_PARTICIPANTS,
  );

  return (
    <ul className="flex items-center gap-3 px-2 py-1 text-sm">
      {participants.map((p) => (
        <li key={p.clientId} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          {p.isLocal ? (
            <>
              <input
                className="w-24 rounded border border-transparent px-1 hover:border-gray-300 focus:border-gray-400 focus:outline-none"
                defaultValue={p.name}
                onChange={(e) => presence.setName(e.target.value)}
                aria-label="내 이름"
              />
              <span className="text-gray-500">(나)</span>
            </>
          ) : (
            <span>{p.name}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
