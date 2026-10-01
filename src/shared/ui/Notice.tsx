import type { ReactNode } from "react";

/** 로드 대기 등 중앙 안내 문구 */
export function CenteredNotice({ children }: { children: ReactNode }) {
  return (
    <div className="text-ink-3 flex h-full items-center justify-center text-[13px]">
      {children}
    </div>
  );
}

/** 저장소를 쓸 수 없을 때의 경고 배너 (S6) */
export function StorageWarningBanner() {
  return (
    <div className="border-line bg-warn-soft text-warn border-b px-3 py-1 text-[12px]">
      브라우저 저장소를 사용할 수 없어 변경 사항이 저장되지 않습니다.
    </div>
  );
}
