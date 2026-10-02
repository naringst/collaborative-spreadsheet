import * as Y from "yjs";
import { createCachedSnapshot } from "@/shared/lib/cached-snapshot";

/** UndoManager 대상은 아니지만(목록은 undo 스코프 밖) 로컬 편집 표식으로 유지한다. */
export const LIST_LOCAL_ORIGIN = Symbol("sheet-list-local");

export const DEFAULT_SHEET_NAME = "제목 없는 시트";

export interface SheetMeta {
  id: string;
  name: string;
  createdAt: number;
}

export interface SheetListStore {
  /** 새 id(crypto.randomUUID)로 항목을 등록하고 id를 반환한다. 생성 즉시 이동용. */
  createSheet(name?: string): string;
  renameSheet(id: string, name: string): void;
  getSheet(id: string): SheetMeta | undefined;
  hasSheet(id: string): boolean;
  /** createdAt 오름차순의 캐시된 배열 (useSyncExternalStore snapshot) */
  getSheets(): readonly SheetMeta[];
  subscribe(listener: () => void): () => void;
}

/**
 * 시트 목록도 셀과 같은 평탄 키("{id}:name", "{id}:createdAt")로 저장한다 —
 * 중첩 Y.Map은 동시 생성 시 컨테이너 LWW 소실 위험 (README "셀 저장 구조"와 동일 근거).
 * id는 UUID라 ":"가 없어 키 파싱이 모호하지 않다.
 */
export function createSheetListStore(doc: Y.Doc): SheetListStore {
  const sheets = doc.getMap<string | number>("sheets");

  function buildList(): SheetMeta[] {
    const byId = new Map<string, Partial<SheetMeta>>();
    for (const [key, value] of sheets.entries()) {
      const sep = key.lastIndexOf(":");
      const id = key.slice(0, sep);
      const field = key.slice(sep + 1);
      const entry = byId.get(id) ?? { id };
      if (field === "name" && typeof value === "string") entry.name = value;
      if (field === "createdAt" && typeof value === "number") {
        entry.createdAt = value;
      }
      byId.set(id, entry);
    }
    const list: SheetMeta[] = [];
    for (const entry of byId.values()) {
      // 동기화 도중 반쪽만 도착한 항목은 두 키가 모두 모이면 나타난다
      if (
        entry.id &&
        entry.name !== undefined &&
        entry.createdAt !== undefined
      ) {
        list.push(entry as SheetMeta);
      }
    }
    return list.sort((a, b) => a.createdAt - b.createdAt);
  }

  const list = createCachedSnapshot<readonly SheetMeta[]>(
    buildList,
    (rebuild) => {
      sheets.observe(rebuild);
      return () => sheets.unobserve(rebuild);
    },
  );

  return {
    createSheet(name = DEFAULT_SHEET_NAME) {
      const id = crypto.randomUUID();
      doc.transact(() => {
        sheets.set(`${id}:name`, name);
        sheets.set(`${id}:createdAt`, Date.now());
      }, LIST_LOCAL_ORIGIN);
      return id;
    },
    renameSheet(id, name) {
      const trimmed = name.trim();
      // 빈 이름·없는 시트·해제된 doc(언마운트 중 blur)은 무시
      if (
        trimmed === "" ||
        doc.isDestroyed ||
        !list.get().some((s) => s.id === id)
      ) {
        return;
      }
      doc.transact(() => {
        sheets.set(`${id}:name`, trimmed);
      }, LIST_LOCAL_ORIGIN);
    },
    getSheet(id) {
      return list.get().find((s) => s.id === id);
    },
    hasSheet(id) {
      return list.get().some((s) => s.id === id);
    },
    getSheets: list.get,
    subscribe: list.subscribe,
  };
}
