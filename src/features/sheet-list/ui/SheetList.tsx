"use client";

import Link from "next/link";
import { useState } from "react";
import type { SheetMeta } from "../store/sheet-list-store";

interface SheetListProps {
  sheets: readonly SheetMeta[];
  activeSheetId?: string;
  collapsed: boolean;
  onToggleCollapse(): void;
  onCreate(): void;
  onRename(id: string, name: string): void;
  sheetHref(id: string): string;
}

function SidebarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="2" y="3" width="12" height="10" rx="2" />
      <path d="M6 3v10" />
    </svg>
  );
}

function SheetIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
      className="shrink-0"
    >
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <path d="M2 6.5h12M6.5 6.5v7" />
    </svg>
  );
}

/**
 * 시트 목록 사이드바: 접기 토글, 시트 행(클릭 = 열기, 더블클릭 = 이름 변경),
 * 새 시트 버튼 (S8)
 */
export function SheetList({
  sheets,
  activeSheetId,
  collapsed,
  onToggleCollapse,
  onCreate,
  onRename,
  sheetHref,
}: SheetListProps) {
  // 이름 변경은 한 번에 하나 — 행 전체가 링크라서 입력창은 요청했을 때만 띄운다
  const [renamingId, setRenamingId] = useState<string | null>(null);

  return (
    // 바깥 aside가 폭을 트랜지션하고, 여기서는 접힘 상태에 맞춰 글자만 숨긴다 —
    // 아이콘은 두 상태에서 같은 x 위치에 두어 접히는 동안 튀지 않는다
    <div className={`flex h-full flex-col ${collapsed ? "w-11" : "w-56"}`}>
      <div
        className={`flex h-12 items-center gap-2 ${collapsed ? "justify-center px-2" : "px-3"}`}
      >
        {!collapsed && (
          <>
            <span
              aria-hidden
              className="bg-ink text-surface grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-bold"
            >
              S
            </span>
            <h1 className="text-sidebar-fg min-w-0 flex-1 truncate text-[13px] font-semibold">
              스프레드시트
            </h1>
          </>
        )}
        <button
          type="button"
          className="text-sidebar-fg-2 hover:bg-sidebar-hover hover:text-sidebar-fg grid h-7 w-7 shrink-0 place-items-center rounded-md"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          aria-expanded={!collapsed}
          title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          <SidebarIcon />
        </button>
      </div>

      <div
        className={`text-sidebar-fg-2 flex items-center pt-2 pb-1 text-[11px] font-medium tracking-wide uppercase ${
          collapsed ? "justify-center px-2" : "justify-between px-3"
        }`}
      >
        {!collapsed && <span>시트</span>}
        <button
          type="button"
          className="text-sidebar-fg-2 hover:bg-sidebar-hover hover:text-sidebar-fg grid h-6 w-6 place-items-center rounded-md text-[15px] leading-none"
          onClick={onCreate}
          aria-label="새 시트"
          title="새 시트"
        >
          +
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5">
        {sheets.length === 0 ? (
          !collapsed && (
            <p className="text-sidebar-fg-2 px-2 py-1 text-[12px]">
              아직 시트가 없습니다. 위의 +로 만들어 보세요.
            </p>
          )
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sheets.map((sheet) => {
              const active = sheet.id === activeSheetId;
              const rowClass = `flex h-7 items-center gap-2 rounded-md text-[13px] ${
                collapsed ? "w-8 justify-center" : "px-2"
              } ${
                active
                  ? "bg-sidebar-2 font-medium text-sidebar-fg shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_var(--color-sidebar-line)]"
                  : "text-sidebar-fg-2 hover:bg-sidebar-hover hover:text-sidebar-fg"
              }`;
              if (renamingId === sheet.id && !collapsed) {
                return (
                  <li key={sheet.id} className={rowClass}>
                    <SheetIcon />
                    <input
                      autoFocus
                      className="border-sidebar-line bg-sidebar text-sidebar-fg min-w-0 flex-1 rounded border px-1 focus:outline-none"
                      defaultValue={sheet.name}
                      // 입력 중 텍스트는 로컬에만 두고 blur/Enter에 확정한다 —
                      // onChange마다 브로드캐스트하면 다른 탭 입력과 한 글자 단위로 충돌한다
                      onBlur={(e) => {
                        // 빈 이름은 store가 무시하므로 저장하지 않고 닫기만 한다
                        if (e.target.value.trim() !== "")
                          onRename(sheet.id, e.target.value);
                        setRenamingId(null);
                      }}
                      onKeyDown={(e) => {
                        // IME 조합 중 Enter는 조합 확정용 — 이름 확정으로 삼지 않는다
                        if (e.nativeEvent.isComposing) return;
                        if (e.key === "Enter") e.currentTarget.blur();
                        else if (e.key === "Escape") {
                          e.currentTarget.value = sheet.name;
                          e.currentTarget.blur();
                        }
                      }}
                      aria-label="시트 이름"
                    />
                  </li>
                );
              }
              return (
                <li key={sheet.id}>
                  <Link
                    href={sheetHref(sheet.id)}
                    aria-current={active ? "page" : undefined}
                    className={rowClass}
                    title={collapsed ? sheet.name : "더블클릭하여 이름 변경"}
                    onDoubleClick={(e) => {
                      if (collapsed) return;
                      e.preventDefault();
                      setRenamingId(sheet.id);
                    }}
                  >
                    <SheetIcon />
                    {!collapsed && (
                      <span className="min-w-0 flex-1 truncate">
                        {sheet.name}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
