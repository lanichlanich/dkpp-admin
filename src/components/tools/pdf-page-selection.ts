type PdfPagePosition = { fileIndex: number; pageNumber: number };

export function movePdfPage<T>(pages: readonly T[], from: number, to: number): readonly T[] {
  if (from === to || from < 0 || to < 0 || from >= pages.length || to >= pages.length) return pages;
  const next = [...pages];
  const [page] = next.splice(from, 1);
  next.splice(to, 0, page);
  return next;
}

export function encodeMergePageOrder(pages: readonly PdfPagePosition[], pageCounts: readonly number[]): string | null {
  if (!pages.length || pages.length !== pageCounts.reduce((total, count) => total + count, 0)) return null;
  const seen = new Set<string>();
  const order: [number, number][] = [];
  for (const { fileIndex, pageNumber } of pages) {
    if (!Number.isInteger(fileIndex) || fileIndex < 0 || fileIndex >= pageCounts.length ||
        !Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCounts[fileIndex]) return null;
    const key = `${fileIndex}:${pageNumber}`;
    if (seen.has(key)) return null;
    seen.add(key);
    order.push([fileIndex, pageNumber]);
  }
  return JSON.stringify(order);
}

export const PDF_SPLIT_MAX_OUTPUTS = 8;
export type SplitPageMode = "combined" | "individual";

export function encodeSplitRanges(selected: ReadonlySet<number>, pageCount: number, mode: SplitPageMode): string | null {
  if (!selected.size || (mode === "individual" && selected.size > PDF_SPLIT_MAX_OUTPUTS)) return null;
  const pages = [...selected].sort((a, b) => a - b);
  if (pages.some(page => !Number.isInteger(page) || page < 1 || page > pageCount)) return null;
  if (mode === "individual") return pages.join(";");
  const ranges: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    const first = pages[i];
    while (pages[i + 1] === pages[i] + 1) i++;
    ranges.push(first === pages[i] ? String(first) : `${first}-${pages[i]}`);
  }
  return ranges.join(",");
}
