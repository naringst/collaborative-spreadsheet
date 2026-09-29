"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import * as Y from "yjs";
import { createSheetStore, type SheetStore } from "@/features/sheet";

const SheetStoreContext = createContext<SheetStore | null>(null);

/**
 * 시트 세션: Y.Doc과 store의 수명을 담당한다.
 * 2단계에서 y-indexeddb·BroadcastChannel provider·UndoManager가 여기에 추가된다.
 */
export function SheetSessionProvider({ children }: { children: ReactNode }) {
  // provider가 없는 Y.Doc은 외부 리소스가 없어(리스너·연결 없음) 해제가 필요 없고
  // 언마운트 시 GC된다. IndexedDB 등 해제가 필요한 것은 2단계에서 effect로 만든다.
  const [store] = useState(() => createSheetStore(new Y.Doc()));

  return (
    <SheetStoreContext.Provider value={store}>
      {children}
    </SheetStoreContext.Provider>
  );
}

export function useSheetStore(): SheetStore {
  const store = useContext(SheetStoreContext);
  if (!store) {
    throw new Error("useSheetStore는 SheetSessionProvider 안에서만 사용할 수 있다");
  }
  return store;
}
