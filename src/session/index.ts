/**
 * session — 기능 조립(composition root)
 *
 * 시트 하나를 열 때 필요한 것들을 생성하고 해제한다.
 *   Y.Doc → persistence → (2단계) broadcast provider·presence → undo
 * React에는 Context로 제공한다.
 *
 * feature 사이의 연결은 이곳에서만 한다.
 */
export { SheetSessionProvider, useSheetStore } from "./SheetSession";
export { SheetScreen } from "./SheetScreen";
