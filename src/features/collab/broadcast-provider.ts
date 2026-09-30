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

export interface BroadcastProvider {
  destroy(): void;
}

export function createBroadcastProvider(opts: {
  channelName: string;
  doc: Y.Doc;
  awareness: Awareness;
}): BroadcastProvider {
  const { channelName, doc, awareness } = opts;
  const channel = new BroadcastChannel(channelName);

  // 이 provider 인스턴스가 원격 적용의 origin이다 — origin이 자신이면 재전송하지
  // 않아 에코 루프가 없고, UndoManager(trackedOrigins=LOCAL)의 undo 대상도 아니다
  const provider: BroadcastProvider = {
    destroy() {
      doc.off("update", onDocUpdate);
      awareness.off("update", onAwarenessUpdate);
      channel.close();
    },
  };

  const post = (message: Message) => channel.postMessage(message);

  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== provider) post({ type: "update", update });
  };

  const onAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === provider) return;
    const changed = [...changes.added, ...changes.updated, ...changes.removed];
    post({
      type: "awareness",
      payload: encodeAwarenessUpdate(awareness, changed),
    });
  };

  channel.onmessage = (e: MessageEvent<Message>) => {
    const message = e.data;
    switch (message.type) {
      case "update":
        Y.applyUpdate(doc, message.update, provider);
        break;
      case "sync-request": {
        post({
          type: "sync-response",
          update: Y.encodeStateAsUpdate(doc, message.stateVector),
          stateVector: Y.encodeStateVector(doc),
        });
        // 새 탭이 내 awareness를 바로 볼 수 있게 전체 상태를 보낸다 (C1)
        post({
          type: "awareness",
          payload: encodeAwarenessUpdate(awareness, [
            ...awareness.getStates().keys(),
          ]),
        });
        break;
      }
      case "sync-response": {
        Y.applyUpdate(doc, message.update, provider);
        // 피어에 없는 내 분량을 돌려준다 (양방향 해소)
        const diff = Y.encodeStateAsUpdate(doc, message.stateVector);
        if (diff.length > 2) post({ type: "update", update: diff });
        break;
      }
      case "awareness":
        applyAwarenessUpdate(awareness, message.payload, provider);
        break;
    }
  };

  doc.on("update", onDocUpdate);
  awareness.on("update", onAwarenessUpdate);
  post({ type: "sync-request", stateVector: Y.encodeStateVector(doc) });
  post({
    type: "awareness",
    payload: encodeAwarenessUpdate(awareness, [doc.clientID]),
  });

  return provider;
}
