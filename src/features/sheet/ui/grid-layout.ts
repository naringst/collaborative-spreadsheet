import { GRID_COLS } from "../model/cell";
import { CELL_H, CELL_W, HEADER_W } from "./metrics";

/**
 * 그리드 컨테이너·헤더 셀의 공통 레이아웃 (Grid와 GridSkeleton이 공유).
 * 치수·헤더 모양이 한 곳에만 있어 둘 사이에 드리프트가 생기지 않는다.
 */

export const GRID_CONTAINER_CLASS = "grid w-max select-none";

export const GRID_CONTAINER_STYLE = {
  gridTemplateColumns: `${HEADER_W}px repeat(${GRID_COLS}, ${CELL_W}px)`,
  gridAutoRows: `${CELL_H}px`,
};

// 열·행·모서리 헤더가 공유하는 테두리·sticky·글자 모양. 배경·선택색은 각자 붙인다.
const HEADER_TEXT = "text-center text-[11px] leading-[26px] font-medium";
export const CORNER_HEADER_CLASS =
  "border-line-2 bg-grid-head sticky top-0 left-0 z-30 border-r border-b";
export const COL_HEADER_CLASS = `border-line-2 sticky top-0 z-20 border-r border-b ${HEADER_TEXT}`;
export const ROW_HEADER_CLASS = `border-line-2 sticky left-0 z-10 border-r border-b ${HEADER_TEXT} tabular-nums`;
