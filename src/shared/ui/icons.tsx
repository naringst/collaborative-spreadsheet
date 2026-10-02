/** 반짝이 아이콘 — AI 편집 진입점·패널 헤더가 공유한다. 색은 currentColor. */
export function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M8 1.5 9.6 6l4.4 1.6L9.6 9.2 8 13.7 6.4 9.2 2 7.6 6.4 6z" />
    </svg>
  );
}
