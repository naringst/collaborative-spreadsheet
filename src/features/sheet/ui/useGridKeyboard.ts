import { useCallback, type KeyboardEvent } from "react";
import type { SheetStore } from "../store/sheet-store";
import type { SheetUndo } from "../store/undo";
import type { EditingApi } from "./useEditing";
import type { SelectionApi } from "./useSelection";

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/** S3 키 매핑의 단일 지점. 문자 입력은 여기서 다루지 않는다 (CellEditor의 beforeinput). */
export function useGridKeyboard(
  store: SheetStore,
  selection: SelectionApi,
  editingApi: EditingApi,
  undoApi?: SheetUndo,
) {
  const { range, active, moveActive, extendBy } = selection;
  const { editing, start, commit, cancel } = editingApi;

  return useCallback(
    (e: KeyboardEvent) => {
      // IME 조합 중에는 모든 특수 키를 무시한다 — Enter는 조합만 끝내고 확정하지 않음 (S2)
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;

      const arrow = ARROWS[e.key];

      if (editing) {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          moveActive(e.shiftKey ? -1 : 1, 0);
        } else if (e.key === "Tab") {
          e.preventDefault();
          commit();
          moveActive(0, e.shiftKey ? -1 : 1);
        } else if (e.key === "Escape") {
          cancel();
        } else if (arrow && editing.mode === "replace") {
          // 바로 입력은 확정 후 이동, 이어서 편집은 input 기본 동작(커서 이동)에 맡긴다 (S3)
          e.preventDefault();
          commit();
          moveActive(arrow[0], arrow[1]);
        }
        return;
      }

      if (arrow) {
        e.preventDefault();
        if (e.shiftKey) extendBy(arrow[0], arrow[1]);
        else moveActive(arrow[0], arrow[1]);
        return;
      }

      // 비편집 ⌘Z/⌘⇧Z/Ctrl+Y = 문서 undo/redo (S5). 편집 모드 ⌘Z는 위 editing
      // 분기에서 안 걸려 input 네이티브 텍스트 undo로 동작한다.
      // preventDefault는 undo 미연결이어도 유지 — 숨은 input의 네이티브 undo 차단.
      if ((e.metaKey || e.ctrlKey) && ["z", "Z", "y"].includes(e.key)) {
        e.preventDefault();
        const isRedo = e.key === "y" || e.shiftKey;
        if (isRedo) undoApi?.redo();
        else undoApi?.undo();
        return;
      }

      switch (e.key) {
        case "Enter":
        case "F2":
          e.preventDefault();
          start(active, "append");
          break;
        case "Tab":
          e.preventDefault();
          moveActive(0, e.shiftKey ? -1 : 1);
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          store.clearRange(range);
          break;
      }
    },
    [
      store,
      range,
      active,
      moveActive,
      extendBy,
      editing,
      start,
      commit,
      cancel,
      undoApi,
    ],
  );
}
