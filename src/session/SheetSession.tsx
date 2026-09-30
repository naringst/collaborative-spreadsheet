"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import * as Y from "yjs";
import {
  createBroadcastProvider,
  createPersistence,
  createPresence,
  type Presence,
} from "@/features/collab";
import {
  createSheetStore,
  createSheetUndo,
  type SheetStore,
  type SheetUndo,
} from "@/features/sheet";

export type SheetSessionValue =
  | { status: "loading" }
  | {
      status: "ready";
      store: SheetStore;
      undo: SheetUndo;
      presence: Presence;
      /** IndexedDB를 쓸 수 없어 메모리로만 동작 중 (S6 P1) */
      storageWarning: boolean;
    };

const SheetSessionContext = createContext<SheetSessionValue | null>(null);

/**
 * 시트 세션: Y.Doc → IndexedDB 로드 → presence → BroadcastChannel provider →
 * UndoManager를 조립하고 역순으로 해제한다. 로드가 끝나기 전에는 loading을
 * 노출해 빈 시트가 깜빡이지 않는다 (S6).
 */
export function SheetSessionProvider({
  sheetId = "default",
  children,
}: {
  sheetId?: string;
  children: ReactNode;
}) {
  const [value, setValue] = useState<SheetSessionValue>({ status: "loading" });

  useEffect(() => {
    const doc = new Y.Doc();
    const store = createSheetStore(doc);
    // undo는 LOCAL_ORIGIN만 추적하므로 먼저 만들어도 이후 IndexedDB 로드·원격
    // 적용분이 스택에 들어가지 않는다 (C7)
    const undo = createSheetUndo(doc);
    const persistence = createPersistence(`sheet-${sheetId}`, doc);

    let disposed = false;
    let dispose: (() => void) | null = null;

    void persistence.whenLoaded.then(({ persisted }) => {
      if (disposed) return;
      // 로드가 끝난 뒤 연결해야 새 탭의 누락분 요청이 로컬 저장분 위에서 계산된다 (C1)
      const presence = createPresence({ doc, sheetId });
      const provider = createBroadcastProvider({
        channelName: `sheet-${sheetId}`,
        doc,
        awareness: presence.awareness,
      });
      dispose = () => {
        presence.destroy();
        provider.destroy();
      };
      setValue({
        status: "ready",
        store,
        undo,
        presence,
        storageWarning: !persisted,
      });
    });

    return () => {
      disposed = true;
      setValue({ status: "loading" });
      dispose?.();
      undo.destroy();
      void persistence.destroy();
      doc.destroy();
    };
  }, [sheetId]);

  return (
    <SheetSessionContext.Provider value={value}>
      {children}
    </SheetSessionContext.Provider>
  );
}

export function useSheetSession(): SheetSessionValue {
  const value = useContext(SheetSessionContext);
  if (!value) {
    throw new Error(
      "useSheetSession은 SheetSessionProvider 안에서만 사용할 수 있다",
    );
  }
  return value;
}
