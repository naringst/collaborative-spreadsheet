import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent,
  type RefObject,
} from "react";
import { moveWithinGrid, type CellAddress } from "../model/cell";
import { CELL_H, CELL_W, HEADER_H, HEADER_W } from "./metrics";

/** 드래그 자동 스크롤: 가장자리 이 거리 안이면 프레임당 이 픽셀만큼 스크롤 */
const EDGE = 24;
const SCROLL_STEP = 16;

/**
 * 포인터 드래그로 선택 범위를 확장한다 (S1). 포인터 캡처로 창 밖에서도
 * move·up이 계속 들어오고, 가장자리에서는 rAF 루프로 자동 스크롤한다 (S1 P1).
 */
export function useDragSelection(
  containerRef: RefObject<HTMLDivElement | null>,
  extendTo: (addr: CellAddress) => void,
) {
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const rafId = useRef<number | null>(null);

  // 포인터 좌표 → 셀 주소. 헤더·콘텐츠 밖 좌표는 가장 가까운 셀로 클램프되어
  // 창 밖 드래그에서도 마지막 행·열까지 확장된다
  const addrFromPointer = useCallback(
    (x: number, y: number): CellAddress | null => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      return moveWithinGrid(
        {
          row: Math.floor(
            (y - rect.top + container.scrollTop - HEADER_H) / CELL_H,
          ),
          col: Math.floor(
            (x - rect.left + container.scrollLeft - HEADER_W) / CELL_W,
          ),
        },
        0,
        0,
      );
    },
    [containerRef],
  );

  const stop = useCallback(() => {
    pointer.current = null;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, []);

  // 드래그 중 언마운트되면 rAF 루프를 정리한다
  useEffect(() => stop, [stop]);

  const begin = useCallback(
    (e: PointerEvent) => {
      containerRef.current?.setPointerCapture(e.pointerId);
      pointer.current = { x: e.clientX, y: e.clientY };

      const step = () => {
        rafId.current = null;
        const p = pointer.current;
        const container = containerRef.current;
        if (!p || !container) return;
        const rect = container.getBoundingClientRect();
        let dx = 0;
        let dy = 0;
        if (p.x < rect.left + HEADER_W + EDGE) dx = -SCROLL_STEP;
        else if (p.x > rect.right - EDGE) dx = SCROLL_STEP;
        if (p.y < rect.top + HEADER_H + EDGE) dy = -SCROLL_STEP;
        else if (p.y > rect.bottom - EDGE) dy = SCROLL_STEP;
        if (dx || dy) {
          container.scrollBy(dx, dy);
          const next = addrFromPointer(p.x, p.y);
          if (next) extendTo(next);
        }
        rafId.current = requestAnimationFrame(step);
      };
      // rafId 가드로 루프는 하나만 돈다 (빠른 down-up-down에서도)
      if (rafId.current === null) rafId.current = requestAnimationFrame(step);
    },
    [containerRef, addrFromPointer, extendTo],
  );

  const move = useCallback(
    (e: PointerEvent) => {
      if (!pointer.current) return;
      if (e.buttons === 0) {
        // 창 밖 등에서 버튼이 이미 놓인 경우의 안전망
        stop();
        return;
      }
      pointer.current = { x: e.clientX, y: e.clientY };
      const addr = addrFromPointer(e.clientX, e.clientY);
      if (addr) extendTo(addr);
    },
    [addrFromPointer, extendTo, stop],
  );

  return { begin, move, stop };
}
