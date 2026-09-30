"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import * as Y from "yjs";
import { createBroadcastProvider, createPersistence } from "@/features/collab";
import {
  createSheetListStore,
  type SheetListStore,
} from "@/features/sheet-list";

export type SheetListSessionValue =
  | { status: "loading" }
  | { status: "ready"; listStore: SheetListStore; storageWarning: boolean };

const SheetListContext = createContext<SheetListSessionValue | null>(null);

/**
 * 시트 목록 세션: 목록 전용 Y.Doc(sheet-registry)의 로드·동기화를 조립한다.
 * 목록에는 참여자 개념이 없어 awareness 없이 doc update만 주고받는다 (S8).
 */
export function SheetListSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [value, setValue] = useState<SheetListSessionValue>({
    status: "loading",
  });

  useEffect(() => {
    const doc = new Y.Doc();
    const listStore = createSheetListStore(doc);
    const persistence = createPersistence("sheet-registry", doc);

    let disposed = false;
    let dispose: (() => void) | null = null;

    void persistence.whenLoaded.then(({ persisted }) => {
      if (disposed) return;
      const provider = createBroadcastProvider({
        channelName: "sheet-registry",
        doc,
      });
      dispose = () => provider.destroy();
      setValue({ status: "ready", listStore, storageWarning: !persisted });
    });

    return () => {
      disposed = true;
      setValue({ status: "loading" });
      dispose?.();
      void persistence.destroy();
      doc.destroy();
    };
  }, []);

  return (
    <SheetListContext.Provider value={value}>
      {children}
    </SheetListContext.Provider>
  );
}

export function useSheetListSession(): SheetListSessionValue {
  const value = useContext(SheetListContext);
  if (!value) {
    throw new Error(
      "useSheetListSession은 SheetListSessionProvider 안에서만 사용할 수 있다",
    );
  }
  return value;
}
