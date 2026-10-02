import { SheetRoute } from "@/composition";

// Next 16: 동적 라우트의 params는 Promise다
export default async function SheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SheetRoute sheetId={id} />;
}
