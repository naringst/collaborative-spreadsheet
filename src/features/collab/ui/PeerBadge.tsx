/**
 * 참여자 색 배지 — 선택 오버레이와 AI 작업 오버레이가 공유한다 (C5·X2).
 * 위치(left·top)는 각 오버레이가 셀 좌표로 계산해 넘긴다.
 */
export function PeerBadge({
  left,
  top,
  color,
  label,
}: {
  left: number;
  top: number;
  color: string;
  label: string;
}) {
  return (
    <div
      className="absolute rounded-[3px_3px_3px_0] px-1.5 text-[10px] leading-4 font-medium whitespace-nowrap text-white"
      style={{ left, top, backgroundColor: color }}
    >
      {label}
    </div>
  );
}
