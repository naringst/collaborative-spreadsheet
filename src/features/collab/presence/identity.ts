const ADJECTIVES = [
  "파란",
  "빨간",
  "초록",
  "노란",
  "보라",
  "은빛",
  "금빛",
  "검은",
  "하얀",
  "분홍",
  "조용한",
  "빠른",
  "용감한",
  "느긋한",
  "명랑한",
  "신중한",
];

const ANIMALS = [
  "고래",
  "여우",
  "수달",
  "부엉이",
  "판다",
  "돌고래",
  "호랑이",
  "펭귄",
  "고슴도치",
  "다람쥐",
  "두루미",
  "물개",
  "너구리",
  "사슴",
  "까치",
  "토끼",
];

export function generateName(rand: () => number = Math.random): string {
  const adjective = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(rand() * ANIMALS.length)];
  return `${adjective} ${animal}`;
}

/** 옅은 선택 배경 위에서도 구분되는 진한 색 (C4: 테두리 대비) */
export const PARTICIPANT_PALETTE: readonly string[] = [
  "#e2445c", // rose
  "#e8732a", // orange
  "#c99a06", // amber
  "#2f9e5b", // green
  "#1a9c94", // teal
  "#7a5af5", // violet
  "#d64da0", // pink
  "#2a8fd6", // sky
];

/**
 * 사용 중이지 않은 색을 우선 배정하고, 모두 사용 중이면 가장 적게 쓰인 색을 준다.
 * 결정적(랜덤 없음)이어야 동시 합류로 충돌한 탭들이 같은 규칙으로 재배정해 수렴한다.
 */
export function pickColor(usedColors: readonly string[]): string {
  let best = PARTICIPANT_PALETTE[0] as string;
  let bestCount = Number.POSITIVE_INFINITY;
  for (const color of PARTICIPANT_PALETTE) {
    const count = usedColors.filter((c) => c === color).length;
    if (count === 0) return color;
    if (count < bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}
