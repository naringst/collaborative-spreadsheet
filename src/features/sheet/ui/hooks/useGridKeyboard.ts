import { useCallback, type KeyboardEvent } from "react";
import { CELL_FORMAT, type CellFormatName } from "../../model/cell-format";
import type { SheetStore } from "../../store/sheet-store";
import type { SheetUndo } from "../../store/undo";
import type { EditingApi } from "./useEditing";
import type { SelectionApi } from "./useSelection";

// e.code(물리 키) 기준 — 한글 자판에서는 e.key가 'ㅠ' 등으로 보고되어 매칭이 깨진다.
// 취소선(⌘⇧X)은 Shift 조건이 있어 매핑 표가 아니라 호출부에서 처리한다.
const FORMAT_SHORTCUTS: Record<string, CellFormatName | undefined> = {
  KeyB: CELL_FORMAT.BOLD,
  KeyI: CELL_FORMAT.ITALIC,
  KeyU: CELL_FORMAT.UNDERLINE,
};

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
      // 서식 단축키는 편집 모드·IME 조합 중에도 동작한다 (S4 P1) — ⌘/Ctrl 조합은
      // 조합 입력이 아니고 input 텍스트를 건드리지 않으므로 isComposing 가드보다 앞.
      // preventDefault로 브라우저 기본 동작(Ctrl+B/U 등)을 차단한다.
      if (e.metaKey || e.ctrlKey) {
        const format =
          e.code === "KeyX" && e.shiftKey
            ? CELL_FORMAT.STRIKE
            : FORMAT_SHORTCUTS[e.code];
        if (format) {
          e.preventDefault();
          store.toggleFormat(range, format);
          return;
        }
      }

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
      // e.code 매칭: 한글 자판에서 e.key는 'ㅋ' 등으로 보고된다.
      if ((e.metaKey || e.ctrlKey) && ["KeyZ", "KeyY"].includes(e.code)) {
        e.preventDefault();
        const isRedo = e.code === "KeyY" || e.shiftKey;
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
