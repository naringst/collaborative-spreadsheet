import { Awareness, removeAwarenessStates } from "y-protocols/awareness";
import type * as Y from "yjs";
import { generateName, pickColor } from "./identity";
import { createPeerLocks, type PeerLocks } from "./peer-locks";

/** useSyncExternalStore의 빈/서버 스냅샷용 안정 참조 (매번 새 배열 금지) */
export const EMPTY_PARTICIPANTS: Participant[] = [];

// y-protocols의 30초 타임아웃보다 짧게 원격 lastUpdated를 갱신해 타임아웃 제거를
// 무력화한다 (C6 P1). 30초보다 충분히 작아야 한다.
const KEEP_ALIVE_INTERVAL_MS = 15_000;

// awareness state는 다른 탭이 보낸 비정형 데이터라 믿을 수 없다 — 깨진 값일 때의 표시 대체
const FALLBACK_NAME = "익명";
const FALLBACK_COLOR = "#64748b"; // slate-500 — identity 팔레트와 겹치지 않는 중립색

export interface Participant {
  clientId: number;
  name: string;
  color: string;
  /** collab 코어는 셀 개념을 모른다 — 구체 타입(SheetCursor)은 collab/ui에 있다 */
  cursor: unknown;
  /** 이 참여자가 AI 편집을 생성·검토 중인 범위·단계. 없으면 null (X2) */
  aiTask: unknown;
  isLocal: boolean;
}

export interface Presence {
  setName(name: string): void;
  setCursor(cursor: unknown): void;
  /** AI 작업 표시를 다른 탭에 알린다. null이면 지운다 (X2) */
  setAiTask(task: unknown): void;
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

  publishLocalIdentity(awareness, doc.clientID);

  // change 핸들러는 역할별로 등록한다 — 색 충돌 해소가 목록 캐시 재계산보다 먼저
  const stopColorWatch = watchColorConflicts(awareness, doc.clientID);
  const stopPeerEviction = watchDeadPeers(awareness, locks);
  const participants = trackParticipants(awareness, doc.clientID);

  const stopLifecycle = bindPageLifecycle(awareness, doc.clientID);
  const stopKeepAlive = startKeepAlive(awareness, locks);

  return {
    setName(name) {
      // 빈 이름은 무시 — 다른 탭에서 식별 불가능해진다 (C4)
      if (name.trim() !== "") awareness.setLocalStateField("name", name.trim());
    },
    setCursor(cursor) {
      awareness.setLocalStateField("cursor", cursor);
    },
    setAiTask(task) {
      awareness.setLocalStateField("aiTask", task);
    },
    getParticipants: participants.get,
    subscribe(listener) {
      awareness.on("change", listener);
      return () => awareness.off("change", listener);
    },
    awareness,
    destroy() {
      stopLifecycle();
      stopKeepAlive();
      stopColorWatch();
      stopPeerEviction();
      participants.stop();
      removeAwarenessStates(awareness, [doc.clientID], "destroy");
      locks?.destroy();
      awareness.destroy();
    },
  };
}

/** 내 신원 발행 — 탭 로드마다 새로 만든다. sessionStorage 금지: 탭 복제 시 복사됨 (C3) */
function publishLocalIdentity(awareness: Awareness, ownClientId: number) {
  awareness.setLocalState({
    name: generateName(),
    color: pickColor(collectColors(awareness, ownClientId)),
    cursor: null,
    aiTask: null,
  });
}

/** 참여자 목록 캐시 — useSyncExternalStore용으로 change 때만 재계산한 안정 참조를 준다 */
function trackParticipants(awareness: Awareness, ownClientId: number) {
  let cached = buildParticipants(awareness, ownClientId);
  const rebuild = () => {
    cached = buildParticipants(awareness, ownClientId);
  };
  awareness.on("change", rebuild);
  return {
    get: () => cached,
    stop: () => awareness.off("change", rebuild),
  };
}

/**
 * 색 충돌 해소 — 같은 색을 쥔 탭이 동시에 합류하면 clientID가 큰 쪽이 재배정한다.
 * 규칙이 결정적이라 모든 탭이 같은 결론에 도달한다 (C4)
 */
function watchColorConflicts(awareness: Awareness, ownClientId: number) {
  const resolve = () => {
    const local = awareness.getLocalState();
    if (!local) return;
    const myColor = local.color as string;
    for (const [clientId, state] of awareness.getStates()) {
      if (
        clientId !== ownClientId &&
        state.color === myColor &&
        clientId < ownClientId
      ) {
        awareness.setLocalStateField(
          "color",
          pickColor(collectColors(awareness, ownClientId)),
        );
        return;
      }
    }
  };
  awareness.on("change", resolve);
  return () => awareness.off("change", resolve);
}

/** 비정상 종료 감지 — Web Locks 해제를 근거로 그 참여자를 목록에서 제거한다 (C6) */
function watchDeadPeers(awareness: Awareness, locks: PeerLocks | null) {
  if (!locks) return () => {};
  const watch = () => {
    for (const clientId of awareness.getStates().keys()) {
      locks.watch(clientId, () => {
        removeAwarenessStates(awareness, [clientId], "peer-lock");
      });
    }
  };
  awareness.on("change", watch);
  return () => awareness.off("change", watch);
}

/** 정상 종료(닫기·새로고침·이동): 즉시 제거 브로드캐스트 → 1초 이내 (C6) */
function bindPageLifecycle(awareness: Awareness, ownClientId: number) {
  const onPageHide = () => {
    removeAwarenessStates(awareness, [ownClientId], "pagehide");
  };
  // bfcache 복원: pagehide에서 지운 로컬 상태를 되살린다 — 안 하면 setLocalStateField가
  // null 상태에서 no-op이라 이 탭이 참여자 표시에서 영구히 사라진다
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted && awareness.getLocalState() === null) {
      publishLocalIdentity(awareness, ownClientId);
    }
  };
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  return () => {
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
  };
}

/**
 * 살아 있음의 근거는 Web Locks다(C6). y-protocols의 30초 타임아웃은 백그라운드
 * 절전 탭(타이머 스로틀링으로 갱신이 늦어짐)을 잘못 제거하므로, locks가 있으면
 * 원격 상태의 lastUpdated를 주기적으로 갱신해 타임아웃 제거를 무력화한다 (C6 P1)
 */
function startKeepAlive(awareness: Awareness, locks: PeerLocks | null) {
  if (!locks) return () => {};
  const keepAlive = setInterval(() => {
    const now = Date.now();
    for (const clientId of awareness.getStates().keys()) {
      const meta = awareness.meta.get(clientId);
      if (meta) meta.lastUpdated = now;
    }
  }, KEEP_ALIVE_INTERVAL_MS);
  return () => clearInterval(keepAlive);
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
          : FALLBACK_NAME,
      color: typeof state.color === "string" ? state.color : FALLBACK_COLOR,
      cursor: state.cursor ?? null,
      aiTask: state.aiTask ?? null,
      isLocal: clientId === ownClientId,
    });
  }
  return participants.sort((a, b) => a.clientId - b.clientId);
}
