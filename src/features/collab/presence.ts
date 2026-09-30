import { Awareness, removeAwarenessStates } from "y-protocols/awareness";
import type * as Y from "yjs";
import { generateName, pickColor } from "./identity";
import { createPeerLocks } from "./peer-locks";

export interface Participant {
  clientId: number;
  name: string;
  color: string;
  /** collab 코어는 셀 개념을 모른다 — 구체 타입(SheetCursor)은 collab/ui에 있다 */
  cursor: unknown;
  isLocal: boolean;
}

export interface Presence {
  setName(name: string): void;
  setCursor(cursor: unknown): void;
  getParticipants(): Participant[];
  subscribe(listener: () => void): () => void;
  /** provider 연결용 — session에서만 사용 */
  awareness: Awareness;
  destroy(): void;
}

export function createPresence(opts: {
  doc: Y.Doc;
  sheetId: string;
}): Presence {
  const { doc, sheetId } = opts;
  const awareness = new Awareness(doc);
  const locks = createPeerLocks(sheetId, doc.clientID);

  // 이름·색은 탭 로드마다 새로 만든다. sessionStorage 금지 — 탭 복제 시 복사됨 (C3)
  awareness.setLocalState({
    name: generateName(),
    color: pickColor(collectColors(awareness, doc.clientID)),
    cursor: null,
  });

  let cached: Participant[] = buildParticipants(awareness, doc.clientID);

  const onChange = () => {
    resolveColorConflict();
    for (const clientId of awareness.getStates().keys()) {
      locks?.watch(clientId, () => {
        removeAwarenessStates(awareness, [clientId], "peer-lock");
      });
    }
    cached = buildParticipants(awareness, doc.clientID);
  };
  awareness.on("change", onChange);

  // 같은 색을 쥔 탭이 동시에 합류하면 clientID가 큰 쪽이 재배정한다 — 규칙이
  // 결정적이라 모든 탭이 같은 결론에 도달한다 (C4)
  function resolveColorConflict() {
    const local = awareness.getLocalState();
    if (!local) return;
    const myColor = local.color as string;
    for (const [clientId, state] of awareness.getStates()) {
      if (
        clientId !== doc.clientID &&
        state.color === myColor &&
        clientId < doc.clientID
      ) {
        awareness.setLocalStateField(
          "color",
          pickColor(collectColors(awareness, doc.clientID)),
        );
        return;
      }
    }
  }

  // 정상 종료(닫기·새로고침·이동): 즉시 제거 브로드캐스트 → 1초 이내 (C6)
  const onPageHide = () => {
    removeAwarenessStates(awareness, [doc.clientID], "pagehide");
  };
  // bfcache 복원: pagehide에서 지운 로컬 상태를 되살린다 — 안 하면 setLocalStateField가
  // null 상태에서 no-op이라 이 탭이 참여자 표시에서 영구히 사라진다
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted && awareness.getLocalState() === null) {
      awareness.setLocalState({
        name: generateName(),
        color: pickColor(collectColors(awareness, doc.clientID)),
        cursor: null,
      });
    }
  };
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);

  // 살아 있음의 근거는 Web Locks다(C6). y-protocols의 30초 타임아웃은 백그라운드
  // 절전 탭(타이머 스로틀링으로 갱신이 늦어짐)을 잘못 제거하므로, locks가 있으면
  // 원격 상태의 lastUpdated를 주기적으로 갱신해 타임아웃 제거를 무력화한다 (C6 P1)
  const keepAlive = locks
    ? setInterval(() => {
        const now = Date.now();
        for (const clientId of awareness.getStates().keys()) {
          const meta = awareness.meta.get(clientId);
          if (meta) meta.lastUpdated = now;
        }
      }, 15_000)
    : null;

  return {
    setName(name) {
      // 빈 이름은 무시 — 다른 탭에서 식별 불가능해진다 (C4)
      if (name.trim() !== "") awareness.setLocalStateField("name", name.trim());
    },
    setCursor(cursor) {
      awareness.setLocalStateField("cursor", cursor);
    },
    getParticipants: () => cached,
    subscribe(listener) {
      awareness.on("change", listener);
      return () => awareness.off("change", listener);
    },
    awareness,
    destroy() {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      if (keepAlive !== null) clearInterval(keepAlive);
      awareness.off("change", onChange);
      removeAwarenessStates(awareness, [doc.clientID], "destroy");
      locks?.destroy();
      awareness.destroy();
    },
  };
}

function collectColors(awareness: Awareness, ownClientId: number): string[] {
  const colors: string[] = [];
  for (const [clientId, state] of awareness.getStates()) {
    if (clientId !== ownClientId && typeof state.color === "string") {
      colors.push(state.color);
    }
  }
  return colors;
}

function buildParticipants(
  awareness: Awareness,
  ownClientId: number,
): Participant[] {
  const participants: Participant[] = [];
  for (const [clientId, state] of awareness.getStates()) {
    participants.push({
      clientId,
      name:
        typeof state.name === "string" && state.name.trim() !== ""
          ? state.name
          : "익명",
      color: typeof state.color === "string" ? state.color : "#64748b",
      cursor: state.cursor ?? null,
      isLocal: clientId === ownClientId,
    });
  }
  return participants.sort((a, b) => a.clientId - b.clientId);
}
