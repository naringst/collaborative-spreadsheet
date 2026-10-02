import type * as Y from "yjs";
import { GRID_COLS, GRID_ROWS, cellKey, type CellAddress } from "../model/cell";
import type { CellFormatName, CellStyleName } from "../model/cell-format";

/**
 * Y.Doc 평탄 맵의 저장 키 인코딩 (README "셀 저장 구조: r:c:속성").
 * 값은 `"r:c:v"`, 서식은 `"r:c:bold"`, 스타일은 `"r:c:align"`처럼 셀 주소와
 * 속성을 키 하나에 넣는다. 저장 레이아웃 지식이라 store에 둔다.
 */

/** 값("r:c:v")은 string, 서식은 true, 정렬은 string, 크기는 number */
export type CellsMap = Y.Map<string | boolean | number>;

export function valueKey(addr: CellAddress): string {
  return `${cellKey(addr)}:v`;
}

export function formatKey(addr: CellAddress, format: CellFormatName): string {
  return `${cellKey(addr)}:${format}`;
}

export function styleKey(addr: CellAddress, style: CellStyleName): string {
  return `${cellKey(addr)}:${style}`;
}

export function parseCellKey(key: string): CellAddress | null {
  // "r:c" 또는 "r:c:속성"에서 앞 두 토큰(주소)만 본다. Number("")가 0이라
  // 빈 토큰이 0으로 새는 것을 막으려 원시 문자열을 먼저 검사한다.
  const [rowStr, colStr] = key.split(":");
  if (!rowStr || !colStr) return null;
  const row = Number(rowStr);
  const col = Number(colStr);
  // 그리드 밖·비정수 키는 손상된 것으로 보고 버린다 — 잘못된 라벨·주소 전파 방지
  if (!Number.isInteger(row) || row < 0 || row >= GRID_ROWS) return null;
  if (!Number.isInteger(col) || col < 0 || col >= GRID_COLS) return null;
  return { row, col };
}
