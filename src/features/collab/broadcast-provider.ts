import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  type Awareness,
} from "y-protocols/awareness";
import * as Y from "yjs";

/**
 * BroadcastChannel로 doc update와 awareness를 같은 origin의 탭에 전파한다 (C1·C2).
 *
 * 연결 시 내 state vector로 sync-request를 보내면 각 피어가 그 시점 이후의
 * diff(sync-response)와 자기 state vector를 돌려주고, 나는 피어에 없는 분량을
 * update로 되돌려 준다 — 양방향으로 누락분이 해소된다 (C1).
 */
type Message =
  | { type: "update"; update: Uint8Array }
  | { type: "sync-request"; stateVector: Uint8Array }
  | { type: "sync-response"; update: Uint8Array; stateVector: Uint8Array }
  | { type: "awareness"; payload: Uint8Array };

// doc 헤더만 담긴 빈 update의 바이트 길이. 이보다 길면 실제 변경이 들어 있다.
const EMPTY_UPDATE_BYTES = 2;

export interface BroadcastProvider {
  destroy(): void;
}

export function createBroadcastProvider(opts: {
  channelName: string;
  doc: Y.Doc;
  /** 참여자 개념이 없는 문서(시트 목록)는 생략 — awareness 송수신을 하지 않는다 */
  awareness?: Awareness;
}): BroadcastProvider {
  const { channelName, doc, awareness } = opts;
  const channel = new BroadcastChannel(channelName);

  // 이 provider 인스턴스가 원격 적용의 origin이다 — origin이 자신이면 재전송하지
  // 않아 에코 루프가 없고, UndoManager(trackedOrigins=LOCAL)의 undo 대상도 아니다.
  // (아래 핸들러들이 origin 비교·해제에 참조하므로 먼저 선언한다.)
  const provider: BroadcastProvider = {
    destroy() {
      doc.off("update", onDocUpdate);
      awareness?.off("update", onAwarenessUpdate);
      channel.close();
    },
  };

  const post = (message: Message) => channel.postMessage(message);

  // awareness 상태를 특정 클라이언트 분량만 인코딩해 보낸다 (세 호출처 공통).
  const postAwareness = (clients: Iterable<number>) => {
    if (!awareness) return;
    post({
      type: "awareness",
      payload: encodeAwarenessUpdate(awareness, [...clients]),
    });
  };

  // ── 보내기: 내 로컬 변경을 피어에 전파 (origin이 자신이면 에코라 무시) ──
  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== provider) post({ type: "update", update });
  };

  const onAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === provider) return;
    postAwareness([...changes.added, ...changes.updated, ...changes.removed]);
  };

  // ── 받기: 피어 메시지별 처리 ──
  const handleSyncRequest = (peerStateVector: Uint8Array) => {
    post({
      type: "sync-response",
      update: Y.encodeStateAsUpdate(doc, peerStateVector),
      stateVector: Y.encodeStateVector(doc),
    });
    // 새 탭이 내 awareness를 바로 볼 수 있게 전체 상태를 보낸다 (C1)
    postAwareness(awareness?.getStates().keys() ?? []);
  };

  const handleSyncResponse = (
    update: Uint8Array,
    peerStateVector: Uint8Array,
  ) => {
    Y.applyUpdate(doc, update, provider);
    // 피어에 없는 내 분량을 돌려준다 (양방향 해소)
    const diff = Y.encodeStateAsUpdate(doc, peerStateVector);
    if (diff.length > EMPTY_UPDATE_BYTES) post({ type: "update", update: diff });
  };

  channel.onmessage = (e: MessageEvent<Message>) => {
    const message = e.data;
    switch (message.type) {
      case "update":
        Y.applyUpdate(doc, message.update, provider);
        break;
      case "sync-request":
        handleSyncRequest(message.stateVector);
        break;
      case "sync-response":
        handleSyncResponse(message.update, message.stateVector);
        break;
      case "awareness":
        if (awareness)
          applyAwarenessUpdate(awareness, message.payload, provider);
        break;
    }
  };

  // ── 연결: 로컬 변경 구독 + 초기 핸드셰이크(누락분 요청·내 awareness 알림) ──
  doc.on("update", onDocUpdate);
  awareness?.on("update", onAwarenessUpdate);
  post({ type: "sync-request", stateVector: Y.encodeStateVector(doc) });
  postAwareness([doc.clientID]);

  return provider;
}
