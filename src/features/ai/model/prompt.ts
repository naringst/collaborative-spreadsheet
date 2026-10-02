import { GRID_COLS, GRID_ROWS } from "@/features/sheet";
import type { AiContext } from "./context";

// ── A1 라벨 ↔ 0-based 좌표 ──────────────────────────────────────────
// sheet의 model은 CellAddress 기반이라 "A1" 문자열 변환은 프롬프트 전용 어휘다.

const COL_A_CODE = "A".charCodeAt(0);

interface Addr {
  row: number;
  col: number;
}

function colLetter(col: number): string {
  return String.fromCharCode(COL_A_CODE + col);
}

function parseLabel(label: string): Addr {
  return {
    col: label.charCodeAt(0) - COL_A_CODE,
    row: Number(label.slice(1)) - 1,
  };
}

function cellLabel({ row, col }: Addr): string {
  return `${colLetter(col)}${row + 1}`;
}

/** from..to(포함) 정수 목록 — 표의 행·열 순회용 */
function span(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function boundingBox(addrs: Addr[]): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  const rows = addrs.map((a) => a.row);
  const cols = addrs.map((a) => a.col);
  return {
    top: Math.min(...rows),
    bottom: Math.max(...rows),
    left: Math.min(...cols),
    right: Math.max(...cols),
  };
}

// ── 프롬프트 렌더링 ─────────────────────────────────────────────────

const EMPTY_CELL = "·";

/**
 * 값 있는 영역의 bounding box를 행 단위 표로 렌더한다 (D9).
 *
 * sparse 목록("A1=…, C2=…")은 모델이 "B열 전체"·"3행 아래" 같은 공간 지시마다
 * 라벨을 좌표로 역산해야 해 off-by-one이 잦았다. 표로 보내면 빈 셀도 자리를
 * 차지해 열이 정렬돼 보이고, 각 행·열 머리에 0-based 인덱스를 함께 적어
 * 출력 스키마(row·col 정수)와의 변환을 모델이 계산하지 않아도 되게 한다.
 */
export function renderSheetTable(cells: AiContext["cells"]): string {
  if (cells.length === 0) return "";

  const valueByLabel = new Map(cells.map((c) => [c.cell, c.value]));
  const box = boundingBox(cells.map((c) => parseLabel(c.cell)));

  const header = span(box.left, box.right)
    .map((col) => `${colLetter(col)}(col ${col})`)
    .join(" | ");

  const rows = span(box.top, box.bottom).map((row) => {
    const line = span(box.left, box.right)
      .map((col) => {
        const value = valueByLabel.get(cellLabel({ row, col }));
        return value === undefined ? EMPTY_CELL : JSON.stringify(value);
      })
      .join(" | ");
    return `행${row + 1}(row ${row}) | ${line}`;
  });

  return [`     | ${header}`, ...rows].join("\n");
}

/** A1 라벨(또는 "B2:D10")을 0-based row·col로 풀어 쓴 설명 — 좌표 변환 오류를 줄인다 */
export function describeLabel(label: string): string {
  const describeOne = (l: string) => {
    const { row, col } = parseLabel(l);
    return `${l}(row ${row}, col ${col})`;
  };
  return label.split(":").map(describeOne).join(":");
}

export function buildSystemPrompt(
  context: AiContext,
  targetLabel: string | null,
): string {
  const table = renderSheetTable(context.cells);
  const scope = targetLabel
    ? `편집 대상은 ${describeLabel(targetLabel)} 범위다. 그 범위 안 셀만 바꿔라.`
    : "시트 전체를 대상으로 한다.";
  return [
    `너는 스프레드시트 편집 도우미다. ${GRID_ROWS}행(1~${GRID_ROWS}) × ${GRID_COLS}열(A~Z) 그리드다.`,
    "사용자 지시에 따라 바꿔야 할 셀만 changes 배열로 제안한다.",
    "출력의 row는 0부터 시작하는 행 인덱스(행1=row 0), col은 0부터 시작하는 열 인덱스(A=col 0, B=col 1, …, Z=col 25)다.",
    "아래 표의 행 머리와 열 머리에 그 인덱스가 적혀 있다 — 표에서 읽은 숫자를 그대로 써라. 직접 계산하지 마라.",
    "바뀌지 않는 셀은 넣지 마라. 값만 제안하고 서식은 건드리지 않는다.",
    // 모델이 한 셀 값을 글자 단위로 쪼개 여러 셀에 흩뿌리는 오해를 막는다
    '사용자가 한 셀에 넣을 값을 주면 그 값을 통째로 그 셀 하나에 넣어라. 값을 글자 단위로 쪼개 여러 셀·행에 나누지 마라. 여러 셀에 나눠 넣는 것은 사용자가 "각 행에", "한 글자씩", 목록 등으로 명시했을 때만 한다.',
    "지시에 셀·범위 위치가 불명확하면 활성 셀 하나만 바꾼다.",
    scope,
    `현재 선택: ${describeLabel(context.selection)}, 활성 셀: ${describeLabel(context.activeCell)}.`,
    table
      ? `값이 있는 영역 (· 는 빈 셀):\n${table}`
      : "값이 있는 셀이 없다(빈 시트).",
  ].join("\n");
}
