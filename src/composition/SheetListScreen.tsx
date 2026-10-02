import { CenteredNotice } from "@/shared/ui/Notice";

/** `/` — 목록은 좌측 사이드바에 상시 표시되므로 본문은 안내만 보여 준다 (S8) */
export function SheetListScreen() {
  return (
    <div className="bg-surface text-ink h-full">
      <CenteredNotice>
        왼쪽에서 시트를 선택하거나 새 시트를 만드세요.
      </CenteredNotice>
    </div>
  );
}
