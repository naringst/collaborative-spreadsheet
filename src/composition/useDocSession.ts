"use client";

import { useEffect, useState, type DependencyList } from "react";
import type { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { createBroadcastProvider, createPersistence } from "@/features/collab";

type DocSessionState<R extends object> =
  | { status: "loading" }
  | ({ status: "ready"; storageWarning: boolean } & R);

/**
 * Y.Doc 세션의 공통 생명주기 (컴포지션 루트 공유).
 *
 * 두 세션(시트 목록·시트 하나)이 똑같이 반복하던 흐름을 한곳에 모은다:
 *   Y.Doc → create(동기 스토어) → persistence 로드 대기 → connect(presence 등)
 *   → BroadcastChannel provider → ready. 해제는 정확히 역순.
 *
 * 로드가 끝난 뒤에야 provider를 연결하는 순서를 지킨다 — 새 탭의 누락분 요청이
 * 로컬 저장분 위에서 계산되어야 하기 때문 (C1). 로드 전에는 loading을 노출해
 * 빈 화면이 깜빡이지 않는다 (S6).
 *
 * @typeParam C create가 동기로 만드는 것들(스토어). ready 값에 펼쳐진다.
 * @typeParam D connect가 로드 후 만드는 것들(presence). ready 값에 합쳐진다.
 */
export function useDocSession<
  C extends object,
  D extends object = Record<string, never>,
>(opts: {
  /** IndexedDB DB 이름이자 BroadcastChannel 이름 */
  name: string;
  /** 이 값이 바뀌면 세션을 새로 조립한다 (예: [sheetId]) */
  deps: DependencyList;
  /** 로드 전 doc에서 동기로 만드는 스토어들 */
  create: (doc: Y.Doc) => C;
  /** 로드 후 연결: value는 ready에 합쳐지고 awareness는 provider에 연결된다 */
  connect?: (
    doc: Y.Doc,
    created: C,
  ) => { value: D; awareness?: Awareness; dispose: () => void };
  /** create가 만든 것들의 해제 (undo, proposalStore 등). doc은 훅이 해제한다 */
  teardown?: (created: C) => void;
}): DocSessionState<C & D> {
  const { name, deps, create, connect, teardown } = opts;
  const [state, setState] = useState<DocSessionState<C & D>>({
    status: "loading",
  });

  useEffect(() => {
    const doc = new Y.Doc();
    const created = create(doc);
    const persistence = createPersistence(name, doc);

    let disposed = false;
    let dispose: (() => void) | null = null;

    void persistence.whenLoaded.then(({ persisted }) => {
      if (disposed) return;
      const conn = connect?.(doc, created);
      const provider = createBroadcastProvider({
        channelName: name,
        doc,
        awareness: conn?.awareness,
      });
      dispose = () => {
        conn?.dispose();
        provider.destroy();
      };
      // 제네릭 스프레드는 TS가 C & D로 좁히지 못해 한 번 단언한다
      setState({
        status: "ready",
        storageWarning: !persisted,
        ...created,
        ...(conn?.value ?? {}),
      } as DocSessionState<C & D>);
    });

    return () => {
      disposed = true;
      setState({ status: "loading" });
      dispose?.();
      teardown?.(created);
      void persistence.destroy();
      doc.destroy();
    };
    // 재조립은 deps로만 제어한다 (name·create·connect는 deps에서 파생된다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
