"use client";

import { SheetGrid } from "@/features/sheet";
import { SheetSessionProvider, useSheetStore } from "./SheetSession";

function GridWithStore() {
  const store = useSheetStore();
  return <SheetGrid store={store} />;
}

/** 세션과 그리드를 조립한 시트 편집 화면 */
export function SheetScreen() {
  return (
    <SheetSessionProvider>
      <GridWithStore />
    </SheetSessionProvider>
  );
}
