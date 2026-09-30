/**
 * sheet-list — 시트 목록 (id·이름·생성시각)
 *
 * 셀 도메인(features/sheet)과 무관한 별도 데이터. 목록 Y.Doc의 구조와 ops를
 * 소유하고, UI는 콜백으로만 바깥과 연결된다. 다른 feature를 import하지 않는다.
 */
export {
  DEFAULT_SHEET_NAME,
  createSheetListStore,
  type SheetListStore,
  type SheetMeta,
} from "./store/sheet-list-store";
export { SheetList } from "./ui/SheetList";
