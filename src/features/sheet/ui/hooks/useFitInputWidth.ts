import { useEffect, type RefObject } from "react";

// Safari 등 field-sizing 미지원 브라우저에서는 JS로 input 너비를 내용에 맞춘다 (S7 편집 시 전체 표시)
const supportsFieldSizing =
  typeof CSS !== "undefined" && CSS.supports("field-sizing", "content");

// scrollWidth에 더하는 여유 — 커서가 오른쪽 끝에 붙어 잘려 보이지 않게
const CARET_GAP_PX = 4;

/**
 * field-sizing: content 폴리필. 편집 중 input 너비를 내용에 맞추고,
 * 편집이 끝나면 지정을 걷어낸다. 반환값은 input의 onInput에 연결한다.
 */
export function useFitInputWidth(
  inputRef: RefObject<HTMLInputElement | null>,
  isEditing: boolean,
): () => void {
  const fitWidthToContent = () => {
    const input = inputRef.current;
    if (!input || supportsFieldSizing) return;
    input.style.width = "0";
    input.style.width = `${input.scrollWidth + CARET_GAP_PX}px`;
  };

  // append 진입은 start()가 input 값을 채우므로 진입 직후에도 너비를 맞춘다
  useEffect(() => {
    if (isEditing) fitWidthToContent();
    else if (inputRef.current) inputRef.current.style.width = "";
  });

  return fitWidthToContent;
}
