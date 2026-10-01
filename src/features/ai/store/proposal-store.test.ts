import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { CellAddress, CellRange, GridCursor } from "@/features/sheet";
import { createSheetStore, createSheetUndo } from "@/features/sheet";
import { AiError, canApply } from "../model/proposal";
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

/**
 * 완료·실패를 외부에서 제어하고, signal·입력을 관찰하는 source.
 * emit으로 onItem을 흘리고, resolve로 완료, reject(err)로 실패시킨다.
 */
function controllableSource() {
  let resolveFn: () => void = () => {};
  let rejectFn: (err: unknown) => void = () => {};
  let emit: (raw: unknown) => void = () => {};
  let signal: AbortSignal | null = null;
  let input: {
    prompt: string;
    targetLabel: string | null;
  } | null = null;
  const source: ProposalSource = (recvInput, onItem, recvSignal) => {
    emit = onItem;
    signal = recvSignal;
    input = { prompt: recvInput.prompt, targetLabel: recvInput.targetLabel };
    return new Promise<void>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
  };
  return {
    source,
    emit: (raw: unknown) => emit(raw),
    resolve: () => resolveFn(),
    reject: (err: unknown) => rejectFn(err),
    get signal() {
      return signal;
    },
    get input() {
      return input;
    },
  };
}

/** 마이크로태스크 큐를 비워 Promise 콜백이 실행되게 한다 */
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("A4/D10 proposal-store — 취소", () => {
  it("cancel하면 status=cancelled, 받은 cells는 유지, apply 무효, signal aborted", async () => {
    const ctl = controllableSource();
    const { store, proposals } = setup(ctl.source);
    proposals.start({ prompt: "x", targetRange: null, cursor: singleCursor });
    ctl.emit({ row: 0, col: 0, value: "a" });

    proposals.cancel();

    const session = proposals.getSession();
    expect(session?.status).toBe("cancelled");
    expect(session?.cells).toHaveLength(1);
    expect(session?.cells[0]?.proposedValue).toBe("a");
    expect(canApply(session?.status ?? "cancelled")).toBe(false);
    expect(ctl.signal?.aborted).toBe(true);

    proposals.apply();
    expect(store.getCellValue(A1)).toBe("");
    // apply해도 세션이 사라지거나 반영되지 않는다
    expect(proposals.getSession()?.status).toBe("cancelled");
  });
});

describe("A6 proposal-store — 실패 분류", () => {
  it("AiError('rate-limit')로 reject하면 status=error, error=rate-limit, 부분 cells 유지, apply 무효", async () => {
    const ctl = controllableSource();
    const { store, proposals } = setup(ctl.source);
    proposals.start({ prompt: "x", targetRange: null, cursor: singleCursor });
    ctl.emit({ row: 0, col: 0, value: "a" });

    ctl.reject(new AiError("rate-limit"));
    await flush();

    const session = proposals.getSession();
    expect(session?.status).toBe("error");
    expect(session?.error).toBe("rate-limit");
    expect(session?.cells).toHaveLength(1);

    proposals.apply();
    expect(store.getCellValue(A1)).toBe("");
  });

  it("일반 Error로 reject하면 error는 network로 분류된다", async () => {
    const ctl = controllableSource();
    const { proposals } = setup(ctl.source);
    proposals.start({ prompt: "x", targetRange: null, cursor: singleCursor });

    ctl.reject(new Error("boom"));
    await flush();

    const session = proposals.getSession();
    expect(session?.status).toBe("error");
    expect(session?.error).toBe("network");
  });
});

describe("A6 proposal-store — retry", () => {
  it("cancel 후 retry하면 같은 입력으로 새 세션이 generating으로 시작하고 cells가 초기화된다", async () => {
    const ctl = controllableSource();
    const { proposals } = setup(ctl.source);
    proposals.start({
      prompt: "fill it",
      targetRange: null,
      cursor: singleCursor,
    });
    ctl.emit({ row: 0, col: 0, value: "a" });
    proposals.cancel();
    expect(proposals.getSession()?.status).toBe("cancelled");

    const firstPrompt = ctl.input?.prompt;
    proposals.retry();

    const session = proposals.getSession();
    expect(session?.status).toBe("generating");
    expect(session?.cells).toHaveLength(0);
    expect(ctl.input?.prompt).toBe(firstPrompt);
    expect(ctl.input?.prompt).toBe("fill it");
  });

  it("실패 후 retry하면 generating으로 복귀한다", async () => {
    const ctl = controllableSource();
    const { proposals } = setup(ctl.source);
    proposals.start({ prompt: "x", targetRange: null, cursor: singleCursor });
    ctl.reject(new AiError("server"));
    await flush();
    expect(proposals.getSession()?.status).toBe("error");

    proposals.retry();
    expect(proposals.getSession()?.status).toBe("generating");
    expect(proposals.getSession()?.error).toBeNull();
  });
});

describe("A4 proposal-store — 요청 교체", () => {
  it("생성 중 다시 start하면 이전 signal이 aborted되고, 이전 요청의 늦은 reject가 새 세션을 덮어쓰지 않는다", async () => {
    let call = 0;
    const first = controllableSource();
    const second = controllableSource();
    const source: ProposalSource = (input, onItem, signal) => {
      call += 1;
      return call === 1
        ? first.source(input, onItem, signal)
        : second.source(input, onItem, signal);
    };
    const { proposals } = setup(source);

    proposals.start({
      prompt: "first",
      targetRange: null,
      cursor: singleCursor,
    });
    proposals.start({
      prompt: "second",
      targetRange: null,
      cursor: singleCursor,
    });

    expect(first.signal?.aborted).toBe(true);
    expect(proposals.getSession()?.status).toBe("generating");

    // 이전 요청이 뒤늦게 실패해도 새 세션(generating)을 덮지 않는다
    first.reject(new AiError("timeout"));
    await flush();
    expect(proposals.getSession()?.status).toBe("generating");
    expect(proposals.getSession()?.error).toBeNull();

    // 늦은 onItem도 새 세션에 끼어들지 않는다
    first.emit({ row: 5, col: 5, value: "late" });
    await flush();
    expect(proposals.getSession()?.cells).toHaveLength(0);
  });
});

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
