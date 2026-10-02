/** 그리드 픽셀 치수. 셀 좌표 ↔ 픽셀 변환(오버레이·편집기 배치)이 이 값에 의존한다. */
export const CELL_W = 112;
export const CELL_H = 26;
export const HEADER_W = 44;
export const HEADER_H = 26;

export type CellRect = ReturnType<typeof cellRect>;

/** 셀 좌표(정규화된 range 경계)를 그리드 콘텐츠 기준 픽셀 사각형으로 변환한다. */
export function cellRect(
  top: number,
  left: number,
  bottom = top,
  right = left,
) {
  return {
    left: HEADER_W + left * CELL_W,
    top: HEADER_H + top * CELL_H,
    width: (right - left + 1) * CELL_W,
    height: (bottom - top + 1) * CELL_H,
  };
}
