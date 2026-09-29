import { useCallback, useState, type RefObject } from "react";
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

  const start = useCallback(
    (addr: CellAddress, mode: EditMode) => {
      const input = inputRef.current;
      if (!input) return;
      if (mode === "append") {
        const value = store.getCellValue(addr);
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
    store.setCellValue(editing.addr, input.value);
    input.value = "";
    setEditing(null);
  }, [store, inputRef, editing]);

  const cancel = useCallback(() => {
    const input = inputRef.current;
    if (input) input.value = "";
    setEditing(null);
  }, [inputRef]);

  return { editing, start, commit, cancel };
}

export type EditingApi = ReturnType<typeof useEditing>;
