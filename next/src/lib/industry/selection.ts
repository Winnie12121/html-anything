import type { DataItem, DataKind, SelectionSet } from "./types";

export function countSelectionByKind(
  itemIds: string[],
  items: DataItem[],
): Partial<Record<DataKind, number>> {
  const selected = new Set(itemIds);
  return items.reduce<Partial<Record<DataKind, number>>>((acc, item) => {
    if (!selected.has(item.id)) return acc;
    acc[item.kind] = (acc[item.kind] ?? 0) + 1;
    return acc;
  }, {});
}

export function makeSelectionSet(
  projectId: string,
  itemIds: string[],
  items: DataItem[],
): SelectionSet {
  const unique = Array.from(new Set(itemIds));
  return {
    projectId,
    selectedItemIds: unique,
    countsByKind: countSelectionByKind(unique, items),
    updatedAt: Date.now(),
  };
}

export function formatKindLabel(kind: DataKind): string {
  const labels: Record<DataKind, string> = {
    job: "Jobs",
    news: "News",
    web_page: "Web Pages",
    sheet_row: "Excel Rows",
    pdf_page: "PDF Pages",
    markdown: "Markdown",
    text: "Text",
    image: "Images",
  };
  return labels[kind];
}
