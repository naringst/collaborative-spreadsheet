import type { CellAddress } from "../model/cell";
import { cellRect, type CellRect } from "./layout/metrics";
import type { EditingApi } from "./hooks/useEditing";
import { useFitInputWidth } from "./hooks/useFitInputWidth";

interface CellEditorProps {
  editor: EditingApi;
  /** 편집 전 input을 세워 둘 위치 — 활성 셀 (선택 상태는 Grid 소관) */
  active: CellAddress;
}

/** D6: 편집 중 다른 참여자가 이 셀을 먼저 확정함 */
function ConflictBadge({ rect }: { rect: CellRect }) {
  return (
    <div
      className="bg-warn-soft text-warn pointer-events-none absolute z-[7] rounded-md px-1.5 py-0.5 text-[11px] whitespace-nowrap shadow-sm"
      style={{ left: rect.left, top: rect.top - 24 }}
    >
      다른 참여자가 이 셀을 변경했습니다
    </div>
  );
}

/**
 * useEditing의 현재 상태를 그리는 뷰. 항상 포커스를 유지하는 단일 input이
 * 편집 전에는 활성 셀 위에 투명하게 놓여 첫 키 입력(한글 조합 포함)을 받는다 —
 * 편집 진입 시 요소 교체·포커스 이동이 없어 IME 첫 글자가 유실되지 않는다 (S2).
 */
export function CellEditor({ editor, active }: CellEditorProps) {
  const { editing, remoteConflict, inputRef } = editor;

  const startHere = () => editor.start(active, "replace");
  const fitWidth = useFitInputWidth(inputRef, editing !== null);

  // input 요소는 하나(S2) — 편집 중/대기 중의 차이는 이 표가 전부다
  const phase = editing
    ? {
        anchor: editing.addr, // 편집 중인 셀에 고정 (undo로 선택이 옮겨가도 안 따라감)
        hiddenClass: "",
        conflict: remoteConflict,
        onBeforeInput: undefined, // 이미 편집 중 — 입력은 input 기본 동작
        onCompositionStart: editor.onCompositionStart,
      }
    : {
        anchor: active, // 다음 입력을 받도록 활성 셀 위에 투명하게 대기
        hiddenClass: "pointer-events-none opacity-0",
        conflict: false,
        onBeforeInput: startHere, // 첫 입력 = 편집 시작
        onCompositionStart: () => {
          editor.onCompositionStart();
          startHere(); // 첫 입력이 한글 조합으로 시작하는 경우
        },
      };
  const rect = cellRect(phase.anchor.row, phase.anchor.col);

  return (
    <>
      {phase.conflict && <ConflictBadge rect={rect} />}
      <input
        ref={inputRef}
        onBeforeInput={phase.onBeforeInput}
        onCompositionStart={phase.onCompositionStart}
        onCompositionEnd={editor.onCompositionEnd}
        onInput={fitWidth}
        onPointerDown={(e) => e.stopPropagation()}
        className={`border-accent bg-surface text-ink absolute z-[6] field-sizing-content border-2 px-1 text-[13px] outline-none ${phase.hiddenClass}`}
        style={{
          left: rect.left,
          top: rect.top,
          height: rect.height,
          minWidth: rect.width,
        }}
      />
    </>
  );
}
