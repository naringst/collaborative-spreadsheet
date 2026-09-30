"use client";

import Link from "next/link";
import type { SheetMeta } from "../store/sheet-list-store";

interface SheetListProps {
  sheets: readonly SheetMeta[];
  onCreate(): void;
  onRename(id: string, name: string): void;
  sheetHref(id: string): string;
}

/** 시트 목록: 열기 링크, 새 시트 버튼, 인라인 이름 변경 (S8) */
export function SheetList({
  sheets,
  onCreate,
  onRename,
  sheetHref,
}: SheetListProps) {
  return (
    <div className="mx-auto w-full max-w-xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">시트 목록</h1>
        <button
          type="button"
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          onClick={onCreate}
        >
          + 새 시트
        </button>
      </div>
      {sheets.length === 0 ? (
        <p className="text-sm text-gray-500">
          아직 시트가 없습니다. 새 시트를 만들어 보세요.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded border border-gray-200">
          {sheets.map((sheet) => (
            // key에 이름을 포함해 저장된 이름이 (원격·자체) 바뀌면 input을 remount한다
            // — uncontrolled input의 defaultValue가 최신 이름으로 갱신된다
            <li
              key={`${sheet.id}:${sheet.name}`}
              className="flex items-center gap-2 px-3 py-2"
            >
              <input
                className="w-56 rounded border border-transparent px-1 text-sm hover:border-gray-300 focus:border-gray-400 focus:outline-none"
                defaultValue={sheet.name}
                // 입력 중 텍스트는 로컬에만 두고 blur/Enter에 확정한다 —
                // onChange마다 브로드캐스트하면 다른 탭 입력과 한 글자 단위로 충돌한다
                onBlur={(e) => {
                  // 빈 이름은 store가 무시하므로 표시를 저장값으로 되돌려 불일치를 막는다
                  if (e.target.value.trim() === "") e.target.value = sheet.name;
                  else onRename(sheet.id, e.target.value);
                }}
                onKeyDown={(e) => {
                  // IME 조합 중 Enter는 조합 확정용 — 이름 확정으로 삼지 않는다
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === "Enter") e.currentTarget.blur();
                  else if (e.key === "Escape") {
                    e.currentTarget.value = sheet.name;
                    e.currentTarget.blur();
                  }
                }}
                aria-label="시트 이름"
              />
              <Link
                href={sheetHref(sheet.id)}
                className="ml-auto text-sm text-blue-600 hover:underline"
              >
                열기
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
