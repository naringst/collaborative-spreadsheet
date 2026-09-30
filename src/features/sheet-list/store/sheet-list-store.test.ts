import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { DEFAULT_SHEET_NAME, createSheetListStore } from "./sheet-list-store";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function newStore() {
  return createSheetListStore(new Y.Doc());
}

// crypto.randomUUID 가용성은 폴리필하지 않고 확인만 한다 (지시).
describe("S8 시트 목록 store — 환경", () => {
  it("node 환경에 globalThis.crypto.randomUUID가 있다", () => {
    expect(typeof globalThis.crypto?.randomUUID).toBe("function");
  });
});

describe("S8 createSheet", () => {
  it("UUID 형태 id를 반환한다", () => {
    const store = newStore();
    const id = store.createSheet();
    expect(id).toMatch(UUID_RE);
  });

  it("이름 없이 만들면 기본 이름을 쓴다", () => {
    const store = newStore();
    const id = store.createSheet();
    expect(store.getSheet(id)?.name).toBe(DEFAULT_SHEET_NAME);
  });

  it("주어진 이름으로 만든다", () => {
    const store = newStore();
    const id = store.createSheet("매출");
    expect(store.getSheet(id)?.name).toBe("매출");
  });

  it("getSheet로 조회 가능하고 getSheets에 포함된다", () => {
    const store = newStore();
    const id = store.createSheet();
    const meta = store.getSheet(id);
    expect(meta?.id).toBe(id);
    expect(store.getSheets().map((s) => s.id)).toContain(id);
  });

  it("서로 다른 시트는 서로 다른 id를 가진다", () => {
    const store = newStore();
    const a = store.createSheet();
    const b = store.createSheet();
    expect(a).not.toBe(b);
  });
});

describe("S8 getSheets 정렬", () => {
  it("createdAt 오름차순으로 정렬한다", () => {
    const store = newStore();
    const ids = [
      store.createSheet("1"),
      store.createSheet("2"),
      store.createSheet("3"),
    ];
    const times = store.getSheets().map((s) => s.createdAt);
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted); // createdAt 오름차순
    // 생성 순서가 유지되어야 한다.
    expect(store.getSheets().map((s) => s.id)).toEqual(ids);
  });

  it("시트가 없으면 빈 배열이다", () => {
    const store = newStore();
    expect(store.getSheets()).toEqual([]);
  });
});

describe("S8 renameSheet", () => {
  it("이름 변경이 반영된다", () => {
    const store = newStore();
    const id = store.createSheet("원래");
    store.renameSheet(id, "바뀜");
    expect(store.getSheet(id)?.name).toBe("바뀜");
  });

  it("빈 문자열은 무시한다 (무변경)", () => {
    const store = newStore();
    const id = store.createSheet("원래");
    store.renameSheet(id, "");
    expect(store.getSheet(id)?.name).toBe("원래");
  });

  it("공백만 있는 이름은 무시한다 (trim 후 빈 문자열)", () => {
    const store = newStore();
    const id = store.createSheet("원래");
    store.renameSheet(id, "   ");
    expect(store.getSheet(id)?.name).toBe("원래");
  });

  it("없는 id는 무시한다 (에러·부작용 없음)", () => {
    const store = newStore();
    const id = store.createSheet("원래");
    expect(() => store.renameSheet("존재하지-않는-id", "새이름")).not.toThrow();
    expect(store.getSheet(id)?.name).toBe("원래");
    expect(store.getSheet("존재하지-않는-id")).toBeUndefined();
  });
});

describe("S8 getSheets 캐시", () => {
  it("변경이 없으면 같은 배열 참조를 반환한다", () => {
    const store = newStore();
    store.createSheet();
    const first = store.getSheets();
    const second = store.getSheets();
    expect(second).toBe(first);
  });

  it("createSheet 후에는 새 참조를 반환한다", () => {
    const store = newStore();
    store.createSheet();
    const before = store.getSheets();
    store.createSheet();
    expect(store.getSheets()).not.toBe(before);
  });

  it("renameSheet 후에는 새 참조를 반환한다", () => {
    const store = newStore();
    const id = store.createSheet("원래");
    const before = store.getSheets();
    store.renameSheet(id, "바뀜");
    expect(store.getSheets()).not.toBe(before);
  });

  it("무시된 renameSheet(빈 이름)는 참조를 바꾸지 않는다", () => {
    const store = newStore();
    const id = store.createSheet("원래");
    const before = store.getSheets();
    store.renameSheet(id, "  ");
    expect(store.getSheets()).toBe(before);
  });
});

describe("S8 subscribe", () => {
  it("createSheet 시 listener를 호출한다", () => {
    const store = newStore();
    const fn = vi.fn();
    store.subscribe(fn);
    store.createSheet();
    expect(fn).toHaveBeenCalled();
  });

  it("renameSheet 시 listener를 호출한다", () => {
    const store = newStore();
    const id = store.createSheet();
    const fn = vi.fn();
    store.subscribe(fn);
    store.renameSheet(id, "바뀜");
    expect(fn).toHaveBeenCalled();
  });

  it("해제 후에는 호출하지 않는다", () => {
    const store = newStore();
    const fn = vi.fn();
    const unsubscribe = store.subscribe(fn);
    unsubscribe();
    store.createSheet();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("C3 동시성 — 시트 목록 병합", () => {
  it("서로 다른 탭에서 만든 시트가 병합 후 양쪽 모두에 존재한다", () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const storeA = createSheetListStore(docA);
    const storeB = createSheetListStore(docB);

    const idA = storeA.createSheet("A의 시트");
    const idB = storeB.createSheet("B의 시트");

    // update를 서로 다른 순서로 교차 적용 (수렴 확인).
    const updA = Y.encodeStateAsUpdate(docA);
    const updB = Y.encodeStateAsUpdate(docB);
    Y.applyUpdate(docA, updB);
    Y.applyUpdate(docB, updA);

    for (const store of [storeA, storeB]) {
      const ids = store.getSheets().map((s) => s.id);
      expect(ids).toContain(idA);
      expect(ids).toContain(idB);
      expect(store.getSheet(idA)?.name).toBe("A의 시트");
      expect(store.getSheet(idB)?.name).toBe("B의 시트");
    }
  });

  it("같은 id를 양쪽에서 다르게 rename하면 병합 후 같은 이름으로 수렴한다 (LWW)", () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const storeA = createSheetListStore(docA);
    const storeB = createSheetListStore(docB);

    // 같은 시트를 공유: A에서 만들고 B로 전달.
    const id = storeA.createSheet("공유");
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    expect(storeB.getSheet(id)?.name).toBe("공유");

    // 양쪽에서 서로 다른 이름으로 변경.
    storeA.renameSheet(id, "A가 지은 이름");
    storeB.renameSheet(id, "B가 지은 이름");

    // 교차 병합.
    const updA = Y.encodeStateAsUpdate(docA);
    const updB = Y.encodeStateAsUpdate(docB);
    Y.applyUpdate(docA, updB);
    Y.applyUpdate(docB, updA);

    const nameA = storeA.getSheet(id)?.name;
    const nameB = storeB.getSheet(id)?.name;
    // 어느 값이 이기는지는 LWW가 정하지만, 양쪽이 같은 값으로 수렴해야 한다.
    expect(nameA).toBe(nameB);
    expect(["A가 지은 이름", "B가 지은 이름"]).toContain(nameA);
  });
});
