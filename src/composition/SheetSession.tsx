"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPresence, type Presence } from "@/features/collab";
import {
  createOpenRouterSource,
  createProposalStore,
  type ProposalStore,
} from "@/features/ai";
import {
  createSheetStore,
  createSheetUndo,
  type SheetStore,
  type SheetUndo,
} from "@/features/sheet";
import { useDocSession } from "./useDocSession";

export type SheetSessionValue =
  | { status: "loading" }
  | {
      status: "ready";
      store: SheetStore;
      undo: SheetUndo;
      presence: Presence;
      proposalStore: ProposalStore;
      /** IndexedDB를 쓸 수 없어 메모리로만 동작 중 (S6 P1) */
      storageWarning: boolean;
    };

// Route Handler(/api/ai/propose) 뒤의 OpenRouter에 붙는 실제 소스. 요청마다
// 상태가 없어 모듈 수준에서 한 번만 만든다.
const proposalSource = createOpenRouterSource();

const SheetSessionContext = createContext<SheetSessionValue | null>(null);

/**
 * 시트 세션: store·undo·proposalStore를 만들고, 로드 후 presence·provider를
 * 연결한다. 생명주기 뼈대는 useDocSession이 맡고, 여기서는 "무엇을 만들고
 * 무엇을 해제하는지"만 선언한다.
 */
export function SheetSessionProvider({
  sheetId = "default",
  children,
}: {
  sheetId?: string;
  children: ReactNode;
}) {
  const value = useDocSession<
    { store: SheetStore; undo: SheetUndo; proposalStore: ProposalStore },
    { presence: Presence }
  >({
    name: `sheet-${sheetId}`,
    deps: [sheetId],
    create: (doc) => {
      const store = createSheetStore(doc);
      // undo는 LOCAL_ORIGIN만 추적하므로 먼저 만들어도 이후 IndexedDB 로드·원격
      // 적용분이 스택에 들어가지 않는다 (C7)
      const undo = createSheetUndo(doc);
      const proposalStore = createProposalStore({
        store,
        undo,
        source: proposalSource,
      });
      return { store, undo, proposalStore };
    },
    connect: (doc) => {
      const presence = createPresence({ doc, sheetId });
      return {
        value: { presence },
        awareness: presence.awareness,
        dispose: () => presence.destroy(),
      };
    },
    teardown: ({ undo, proposalStore }) => {
      proposalStore.destroy();
      undo.destroy();
    },
  });

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
