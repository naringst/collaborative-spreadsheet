import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { CellAddress } from "../model/cell";
import type { SheetStore } from "../store/sheet-store";

/** replace: 바로 입력(기존 값 대체), append: Enter·F2·더블클릭(기존 값 이어서 편집) */
export type EditMode = "replace" | "append";

export interface EditingState {
  addr: CellAddress;
  mode: EditMode;
}

/**
 * 편집 모드 상태. 입력 중 텍스트는 React state가 아니라 input DOM에만 둔다 —
 * 제어 컴포넌트로 만들면 IME 조합이 리렌더에 끊길 수 있다.
 */
export function useEditing(
  store: SheetStore,
  inputRef: RefObject<HTMLInputElement | null>,
) {
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
    [store, inputRef],
  );

  const commit = useCallback(() => {
    const input = inputRef.current;
    if (!input || !editing) return;
    store.setCellValue(editing.addr, input.value); // 원격이 먼저 확정했어도 내 값이 이긴다 (D6 LWW)
    input.value = "";
    setEditing(null);
    setRemoteConflict(false);
  }, [store, inputRef, editing]);

  const cancel = useCallback(() => {
    const input = inputRef.current;
    if (input) input.value = "";
    setEditing(null);
    setRemoteConflict(false); // Esc면 Cell이 store를 읽으므로 상대 값이 그대로 보인다 (D6)
  }, [inputRef]);

  return { editing, remoteConflict, start, commit, cancel };
}

export type EditingApi = ReturnType<typeof useEditing>;
