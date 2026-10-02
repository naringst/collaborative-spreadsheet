import { useEffect } from "react";
import type { CellAddress } from "../model/cell";
import { cellRect } from "./layout/metrics";
import type { EditingApi } from "./hooks/useEditing";

// Safari 등 field-sizing 미지원 브라우저에서는 JS로 input 너비를 내용에 맞춘다 (S7 편집 시 전체 표시)
const supportsFieldSizing =
  typeof CSS !== "undefined" && CSS.supports("field-sizing", "content");

interface CellEditorProps {
  editor: EditingApi;
  /** 편집 전 input을 세워 둘 위치 — 활성 셀 (선택 상태는 Grid 소관) */
  active: CellAddress;
}

/**
 * useEditing의 현재 상태를 그리는 뷰. 항상 포커스를 유지하는 단일 input이
 * 편집 전에는 활성 셀 위에 투명하게 놓여 첫 키 입력(한글 조합 포함)을 받는다 —
 * 편집 진입 시 요소 교체·포커스 이동이 없어 IME 첫 글자가 유실되지 않는다 (S2).
 */
export function CellEditor({ editor, active }: CellEditorProps) {
  const { editing, remoteConflict, inputRef } = editor;
  const addr = editing?.addr ?? active;
  const rect = cellRect(addr.row, addr.col);

  const startHere = () => {
    if (!editing) editor.start(active, "replace");
  };

  const fitWidthToContent = () => {
    const input = inputRef.current;
    if (!input || supportsFieldSizing) return;
    input.style.width = "0";
    input.style.width = `${input.scrollWidth + 4}px`;
  };

  // append 진입은 start()가 input 값을 채우므로 진입 직후에도 너비를 맞춘다
  useEffect(() => {
    if (editing) fitWidthToContent();
    else if (inputRef.current) inputRef.current.style.width = "";
  });

  return (
    <>
      {editing && remoteConflict && (
        <div
          className="bg-warn-soft text-warn pointer-events-none absolute z-[7] rounded-md px-1.5 py-0.5 text-[11px] whitespace-nowrap shadow-sm"
          style={{ left: rect.left, top: rect.top - 24 }}
        >
          다른 참여자가 이 셀을 변경했습니다
        </div>
      )}
      <input
        ref={inputRef}
        onBeforeInput={startHere}
        onCompositionStart={() => {
          editor.onCompositionStart();
          startHere();
        }}
        onCompositionEnd={editor.onCompositionEnd}
        onInput={fitWidthToContent}
        onPointerDown={(e) => e.stopPropagation()}
        className={`border-accent bg-surface text-ink absolute z-[6] field-sizing-content border-2 px-1 text-[13px] outline-none ${
          editing ? "" : "pointer-events-none opacity-0"
        }`}
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
