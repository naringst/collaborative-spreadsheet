import { GRID_COLS, GRID_ROWS, columnLabel } from "../model/cell";
import {
  COL_HEADER_CLASS,
  CORNER_HEADER_CLASS,
  GRID_CONTAINER_CLASS,
  GRID_CONTAINER_STYLE,
  ROW_HEADER_CLASS,
} from "./grid-layout";

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
      <div className={GRID_CONTAINER_CLASS} style={GRID_CONTAINER_STYLE}>
        <div className={CORNER_HEADER_CLASS} />
        {COLS.map((col) => (
          <div
            key={col}
            className={`${COL_HEADER_CLASS} bg-grid-head text-ink-2`}
          >
            {columnLabel(col)}
          </div>
        ))}
        {ROWS.map((row) => (
          <div key={row} className="contents">
            <div className={`${ROW_HEADER_CLASS} bg-grid-head text-ink-2`}>
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
