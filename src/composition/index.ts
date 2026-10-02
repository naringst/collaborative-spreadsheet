/**
 * composition — 컴포지션 루트 (features 위 계층)
 *
 * 한 Y.Doc 세션에 필요한 것들을 생성하고 역순으로 해제한다.
 *   Y.Doc → persistence → broadcast provider·presence → undo
 * React에는 Context로 제공하고, feature들을 한 화면으로 조립한다.
 *
 * feature 사이의 연결은 이곳에서만 한다. features는 이 계층을 모른다.
 */
export { SheetSessionProvider, useSheetSession } from "./SheetSession";
export { SheetScreen } from "./SheetScreen";
export {
  SheetListSessionProvider,
  useSheetListSession,
} from "./SheetListSession";
export { SheetListScreen } from "./SheetListScreen";
export { SheetListSidebar } from "./SheetListSidebar";
export { SheetRoute } from "./SheetRoute";
