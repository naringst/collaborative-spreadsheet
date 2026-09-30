import { useCallback, useState } from "react";
import { moveWithinGrid, type CellAddress } from "../model/cell";
import type { CellRange } from "../model/range";

const ORIGIN: CellAddress = { row: 0, col: 0 };

/** 선택 범위 상태. 활성 셀은 항상 range.anchor다 (Shift 확장은 focus만 움직임). */
export function useSelection() {
  const [range, setRange] = useState<CellRange>({
    anchor: ORIGIN,
    focus: ORIGIN,
  });

  const selectCell = useCallback((addr: CellAddress) => {
    setRange({ anchor: addr, focus: addr });
  }, []);

  const extendTo = useCallback((addr: CellAddress) => {
    setRange((r) => ({ anchor: r.anchor, focus: addr }));
  }, []);

  const moveActive = useCallback((dRow: number, dCol: number) => {
    setRange((r) => {
      const next = moveWithinGrid(r.anchor, dRow, dCol);
      return { anchor: next, focus: next };
    });
  }, []);

  const extendBy = useCallback((dRow: number, dCol: number) => {
    setRange((r) => ({
      anchor: r.anchor,
      focus: moveWithinGrid(r.focus, dRow, dCol),
    }));
  }, []);

  return {
    range,
    active: range.anchor,
    selectCell,
    extendTo,
    moveActive,
    extendBy,
  };
}

export type SelectionApi = ReturnType<typeof useSelection>;
