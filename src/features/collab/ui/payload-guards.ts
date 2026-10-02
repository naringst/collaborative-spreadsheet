/**
 * awareness 페이로드 런타임 가드 (collab/ui 공용). 구버전 탭이 다른 스키마를
 * 보내도 오버레이가 렌더 중 throw하지 않도록, 그리기 전에 모양을 검증한다.
 */
export function isCellAddress(v: unknown): v is { row: number; col: number } {
  if (typeof v !== "object" || v === null) return false;
  const a = v as { row?: unknown; col?: unknown };
  return typeof a.row === "number" && typeof a.col === "number";
}
