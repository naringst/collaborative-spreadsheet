import type { ReactNode } from "react";

interface TooltipProps {
  label: string;
  /** 단축키 표시 (예: "⌘B") — 라벨 옆에 흐리게 */
  shortcut?: string;
  children: ReactNode;
}

/**
 * hover·focus 시 아래에 뜨는 라벨+단축키 툴팁. 네이티브 title보다 즉시 뜨고
 * 모양을 통일한다. 감싼 요소 하나만 자식으로 둔다.
 */
export function Tooltip({ label, shortcut, children }: TooltipProps) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="bg-ink text-surface pointer-events-none absolute top-full left-1/2 z-50 mt-1.5 -translate-x-1/2 rounded-md px-2 py-1 text-[11px] leading-none whitespace-nowrap opacity-0 shadow-sm transition-opacity delay-150 group-hover:opacity-100 group-has-focus-visible:opacity-100"
      >
        {label}
        {shortcut && <span className="text-ink-3 ml-1.5">{shortcut}</span>}
      </span>
    </span>
  );
}
