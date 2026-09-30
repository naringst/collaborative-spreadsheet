import { IndexeddbPersistence } from "y-indexeddb";
import type * as Y from "yjs";

export interface Persistence {
  /** persisted=false면 IndexedDB를 쓸 수 없어 메모리로만 동작한다 (S6 P1 경고) */
  whenLoaded: Promise<{ persisted: boolean }>;
  destroy(): Promise<void>;
}

function probeIndexedDb(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open("idb-probe");
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        request.result.close();
        resolve(true);
      };
    } catch {
      resolve(false);
    }
  });
}

export function createPersistence(dbName: string, doc: Y.Doc): Persistence {
  let idb: IndexeddbPersistence | null = null;

  const whenLoaded = (async () => {
    // y-indexeddb의 whenSynced는 open이 비동기로 거부되면(사설 모드 차단 등)
    // 영원히 resolve되지 않는다 — 먼저 open을 직접 시도해 사용 가능 여부를 확인한다
    if (!(await probeIndexedDb())) return { persisted: false };
    try {
      idb = new IndexeddbPersistence(dbName, doc);
      await idb.whenSynced;
      return { persisted: true };
    } catch {
      // 시트는 메모리로만 계속 동작한다 (S6 P1)
      idb = null;
      return { persisted: false };
    }
  })();

  return {
    whenLoaded,
    async destroy() {
      await whenLoaded;
      idb?.destroy();
    },
  };
}
