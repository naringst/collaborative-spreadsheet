import { useCallback, useEffect, useRef, useState } from "react";
import type { CellAddress } from "../../model/cell";
import type { SheetStore } from "../../store/sheet-store";

/** replace: 바로 입력(기존 값 대체), append: Enter·F2·더블클릭(기존 값 이어서 편집) */
export type EditMode = "replace" | "append";

export interface EditingState {
  addr: CellAddress;
  mode: EditMode;
}

/**
 * 셀 편집 세션의 수명주기를, 그 저장소인 input DOM과 함께 관리한다.
 * 입력 중 텍스트는 React state가 아니라 input DOM에만 둔다 — 제어 컴포넌트로
 * 만들면 IME 조합이 리렌더에 끊길 수 있다. input 요소와 조합 플래그를 여기서
 * 소유하고, 밖에는 동작 이름의 API만 내놓는다 (ref가 경계를 넘지 않게).
 */
export function useEditing(store: SheetStore) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  // D6: 편집 시작 시점의 문서 값. 편집 중 이 값과 달라지면 외부(원격) 변경이다 —
  // 내 입력은 확정 전까지 input DOM에만 있으므로 이 셀의 store 변경은 전부 외부 요인
  const baseline = useRef("");
  const [remoteConflict, setRemoteConflict] = useState(false);

  useEffect(() => {
    if (!editing) return;
    return store.subscribe((info) => {
      // 내 undo/redo(툴바)도 이 셀을 바꿀 수 있다 — 로컬 변경은 충돌이 아니다
      if (info?.isLocalChange) return;
      // 원격이 undo 등으로 baseline과 같은 값으로 되돌아오면 경고도 해제한다
      setRemoteConflict(store.getCellValue(editing.addr) !== baseline.current);
    });
  }, [store, editing]);

  const start = useCallback(
    (addr: CellAddress, mode: EditMode) => {
      const input = inputRef.current;
      if (!input) return;
      const value = store.getCellValue(addr);
      baseline.current = value;
      setRemoteConflict(false);
      if (mode === "append") {
        input.value = value;
        input.setSelectionRange(value.length, value.length);
      }
      // replace는 input이 이미 비어 있으므로 그대로 둔다 (조합 중인 글자 보존)
      setEditing({ addr, mode });
    },
    [store],
  );

  const commit = useCallback(() => {
    const input = inputRef.current;
    if (!input || !editing) return;
    store.setCellValue(editing.addr, input.value); // 원격이 먼저 확정했어도 내 값이 이긴다 (D6 LWW)
    input.value = "";
    setEditing(null);
    setRemoteConflict(false);
  }, [store, editing]);

  const cancel = useCallback(() => {
    const input = inputRef.current;
    if (input) input.value = "";
    setEditing(null);
    setRemoteConflict(false); // Esc면 Cell이 store를 읽으므로 상대 값이 그대로 보인다 (D6)
  }, []);

  /** 키보드 입력(문자·조합 포함)이 항상 편집 input으로 들어가게 한다 */
  const focus = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const onCompositionEnd = useCallback(() => {
    composingRef.current = false;
  }, []);

  /**
   * 진행 중인 IME 조합을 강제로 확정시켜 input.value에 반영한다 — blur가 조합을
   * 끝내는 브라우저 동작을 이용. 조합 중간 상태로 커밋되거나 잔여 글자가
   * 되살아나는 것을 막는다. 조합 중이 아니면 아무것도 하지 않는다.
   */
  const abortComposition = useCallback(() => {
    if (!composingRef.current) return;
    inputRef.current?.blur();
    inputRef.current?.focus({ preventScroll: true });
    composingRef.current = false;
  }, []);

  return {
    /** CellEditor가 그리는 input에 단다 — DOM 접점은 이 한 곳뿐 */
    inputRef,
    editing,
    remoteConflict,
    start,
    commit,
    cancel,
    focus,
    onCompositionStart,
    onCompositionEnd,
    abortComposition,
  };
}

export type EditingApi = ReturnType<typeof useEditing>;
