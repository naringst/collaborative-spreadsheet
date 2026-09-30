import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { CellAddress, CellRange, GridCursor } from "@/features/sheet";
import { createSheetStore, createSheetUndo } from "@/features/sheet";
import { canApply } from "../model/proposal";
import { createProposalStore, type ProposalSource } from "./proposal-store";

const A1: CellAddress = { row: 0, col: 0 };
const B2: CellAddress = { row: 1, col: 1 };

const singleCursor: GridCursor = {
  range: { anchor: A1, focus: A1 },
  editing: null,
};

function setup(source: ProposalSource) {
  const doc = new Y.Doc();
  const store = createSheetStore(doc);
  const undo = createSheetUndo(doc);
  const proposals = createProposalStore({ store, undo, source });
  return { doc, store, undo, proposals };
}

/** onItem을 동기로 여러 번 부르고 즉시 완료하는 source */
function syncSource(items: unknown[]): ProposalSource {
  return async (_input, onItem) => {
    for (const raw of items) onItem(raw);
  };
}

/** 완료를 외부에서 제어하는 source (generating 상태 관찰용) */
function deferredSource() {
  let resolveFn: () => void = () => {};
  let emit: (raw: unknown) => void = () => {};
  const source: ProposalSource = (_input, onItem) => {
    emit = onItem;
    return new Promise<void>((resolve) => {
      resolveFn = resolve;
    });
  };
  return {
    source,
    emit: (raw: unknown) => emit(raw),
    finish: () => resolveFn(),
  };
}

describe("A3/A4 proposal-store — 생성·누적·완료", () => {
  it("start 후 완료되면 status=complete이고 cells가 누적된다", async () => {
    const { proposals } = setup(
      syncSource([
        { row: 0, col: 0, value: "a" },
        { row: 1, col: 1, value: "b" },
      ]),
    );
    await new Promise<void>((r) => {
      proposals.subscribe(() => {
        if (proposals.getSession()?.status === "complete") r();
      });
      proposals.start({
        prompt: "fill",
        targetRange: null,
        cursor: singleCursor,
      });
    });
    const session = proposals.getSession();
    expect(session?.status).toBe("complete");
    expect(session?.cells).toHaveLength(2);
    expect(session?.cells[0]?.proposedValue).toBe("a");
  });

  it("start 직후 status는 generating이며 canApply(generating)=false", () => {
    const { source } = deferredSource();
    const { proposals } = setup(source);
    proposals.start({ prompt: "x", targetRange: null, cursor: singleCursor });
    const status = proposals.getSession()?.status;
    expect(status).toBe("generating");
    expect(canApply(status ?? "generating")).toBe(false);
  });

  it("complete로 전이하면 canApply=true", () => {
    expect(canApply("complete")).toBe(true);
    expect(canApply("cancelled")).toBe(false);
  });
});

describe("A3 proposal-store — apply는 complete에서만", () => {
  it("complete 후 apply하면 시트에 반영되고 session=null", async () => {
    const { store, proposals } = setup(
      syncSource([
        { row: 0, col: 0, value: "a" },
        { row: 1, col: 1, value: "b" },
      ]),
    );
    await new Promise<void>((r) => {
      proposals.subscribe(() => {
        if (proposals.getSession()?.status === "complete") r();
      });
      proposals.start({ prompt: "x", targetRange: null, cursor: singleCursor });
    });
    proposals.apply();
    expect(store.getCellValue(A1)).toBe("a");
    expect(store.getCellValue(B2)).toBe("b");
    expect(proposals.getSession()).toBeNull();
  });

  it("generating 중 apply는 무시된다 (시트 미반영, session 유지)", () => {
    const { source } = deferredSource();
    const { store, proposals } = setup(source);
    proposals.start({ prompt: "x", targetRange: null, cursor: singleCursor });
    proposals.apply();
    expect(store.getCellValue(A1)).toBe("");
    expect(proposals.getSession()?.status).toBe("generating");
  });
});

describe("A5 proposal-store — apply는 undo 1회로 되돌아간다", () => {
  it("적용한 여러 셀이 undo 1회로 전부 복원된다", async () => {
    const { store, undo, proposals } = setup(
      syncSource([
        { row: 0, col: 0, value: "a" },
        { row: 1, col: 1, value: "b" },
      ]),
    );
    await new Promise<void>((r) => {
      proposals.subscribe(() => {
        if (proposals.getSession()?.status === "complete") r();
      });
      proposals.start({ prompt: "x", targetRange: null, cursor: singleCursor });
    });
    proposals.apply();
    undo.undo();
    expect(store.getCellValue(A1)).toBe("");
    expect(store.getCellValue(B2)).toBe("");
  });
});

describe("A3 proposal-store — discard", () => {
  it("discard하면 session=null이고 시트는 안 바뀐다", async () => {
    const { store, proposals } = setup(
      syncSource([{ row: 0, col: 0, value: "a" }]),
    );
    await new Promise<void>((r) => {
      proposals.subscribe(() => {
        if (proposals.getSession()?.status === "complete") r();
      });
      proposals.start({ prompt: "x", targetRange: null, cursor: singleCursor });
    });
    proposals.discard();
    expect(proposals.getSession()).toBeNull();
    expect(store.getCellValue(A1)).toBe("");
  });
});

describe("D8 proposal-store — 범위 밖 항목은 버려진다", () => {
  it("targetRange 밖 제안은 cells에 들어가지 않는다", async () => {
    const range: CellRange = {
      anchor: { row: 1, col: 1 },
      focus: { row: 9, col: 3 },
    }; // B2:D10
    const { proposals } = setup(
      syncSource([
        { row: 5, col: 2, value: "in" }, // 범위 안
        { row: 0, col: 0, value: "out" }, // 범위 밖
      ]),
    );
    await new Promise<void>((r) => {
      proposals.subscribe(() => {
        if (proposals.getSession()?.status === "complete") r();
      });
      proposals.start({
        prompt: "x",
        targetRange: range,
        cursor: singleCursor,
      });
    });
    const cells = proposals.getSession()?.cells ?? [];
    expect(cells).toHaveLength(1);
    expect(cells[0]?.proposedValue).toBe("in");
  });

  it("형식이 잘못된 항목도 버려진다", async () => {
    const { proposals } = setup(
      syncSource([
        { row: 0, col: 0, value: "ok" },
        { row: "bad", col: 0, value: "x" },
        { nope: true },
      ]),
    );
    await new Promise<void>((r) => {
      proposals.subscribe(() => {
        if (proposals.getSession()?.status === "complete") r();
      });
      proposals.start({ prompt: "x", targetRange: null, cursor: singleCursor });
    });
    expect(proposals.getSession()?.cells).toHaveLength(1);
  });
});

describe("X1 proposal-store — base는 요청 시점 값으로 고정", () => {
  it("start 후 store를 바꿔도 baseValue는 요청 시점 값이다", async () => {
    // 동기 source가 아니라 지연 source로, start 시점 스냅샷이 고정되는지 본다
    const deferred = deferredSource();
    const { store, proposals } = setup(deferred.source);
    store.setCellValue(A1, "before");

    proposals.start({ prompt: "x", targetRange: null, cursor: singleCursor });
    // 요청 후 다른 참여자가 셀을 바꾼 상황을 흉내낸다
    store.setCellValue(A1, "after");

    deferred.emit({ row: 0, col: 0, value: "proposed" });
    deferred.finish();
    await Promise.resolve();
    await Promise.resolve();

    const cell = proposals
      .getSession()
      ?.cells.find((c) => c.addr.row === 0 && c.addr.col === 0);
    expect(cell?.baseValue).toBe("before");
  });
});

describe("A4 proposal-store — AbortSignal / 늦은 onItem 무시", () => {
  it("discard 후 도착한 이전 source의 onItem은 무시된다", async () => {
    const deferred = deferredSource();
    const { proposals } = setup(deferred.source);
    proposals.start({ prompt: "x", targetRange: null, cursor: singleCursor });
    proposals.discard();
    expect(proposals.getSession()).toBeNull();

    // 취소된 요청이 뒤늦게 onItem을 부른다
    deferred.emit({ row: 0, col: 0, value: "late" });
    await Promise.resolve();
    // 여전히 새 세션이 생기지 않아야 한다
    expect(proposals.getSession()).toBeNull();
  });
});
