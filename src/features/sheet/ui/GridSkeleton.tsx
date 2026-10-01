import { GRID_COLS, GRID_ROWS, columnLabel } from "../model/cell";
import { CELL_H, CELL_W, HEADER_W } from "./metrics";

const ROWS = Array.from({ length: GRID_ROWS }, (_, i) => i);
const COLS = Array.from({ length: GRID_COLS }, (_, i) => i);

/**
 * 시트 로드 전 자리 표시 (S6). 행·열 헤더는 실제 그리드와 같은 치수로 그리고
 * 셀 영역만 비워 두어, 로드가 끝나면 헤더가 움직이지 않고 값만 채워진다.
 */
export function SheetGridSkeleton() {
  return (
    <div
      className="bg-surface text-ink relative h-full overflow-hidden"
      aria-busy
      aria-label="시트를 불러오는 중"
    >
      <div
        className="grid w-max select-none"
        style={{
          gridTemplateColumns: `${HEADER_W}px repeat(${GRID_COLS}, ${CELL_W}px)`,
          gridAutoRows: `${CELL_H}px`,
        }}
      >
        <div className="border-line-2 bg-grid-head sticky top-0 left-0 z-30 border-r border-b" />
        {COLS.map((col) => (
          <div
            key={col}
            className="border-line-2 bg-grid-head text-ink-2 sticky top-0 z-20 border-r border-b text-center text-[11px] leading-[26px] font-medium"
          >
            {columnLabel(col)}
          </div>
        ))}
        {ROWS.map((row) => (
          <div key={row} className="contents">
            <div className="border-line-2 bg-grid-head text-ink-2 sticky left-0 z-10 border-r border-b text-center text-[11px] leading-[26px] font-medium tabular-nums">
              {row + 1}
            </div>
            {COLS.map((col) => (
              <div
                key={col}
                className="border-line animate-pulse border-r border-b"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
