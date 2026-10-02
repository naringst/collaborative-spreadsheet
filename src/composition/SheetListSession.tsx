"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  createSheetListStore,
  type SheetListStore,
} from "@/features/sheet-list";
import { useDocSession } from "./useDocSession";

export type SheetListSessionValue =
  | { status: "loading" }
  | { status: "ready"; listStore: SheetListStore; storageWarning: boolean };

const SheetListContext = createContext<SheetListSessionValue | null>(null);

/**
 * 시트 목록 세션: 목록 전용 Y.Doc(sheet-registry)만 조립한다. 참여자 개념이
 * 없어 presence·awareness 없이 doc update만 주고받는다 (S8).
 */
export function SheetListSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const value = useDocSession<{ listStore: SheetListStore }>({
    name: "sheet-registry",
    deps: [],
    create: (doc) => ({ listStore: createSheetListStore(doc) }),
  });

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
