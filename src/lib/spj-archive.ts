export const SPJ_ARCHIVE_PAGE_SIZES = [10, 20, 50, 100] as const;
export type SpjArchiveQuery = { search: string; page: number; pageSize: number };
export function spjArchiveQuery(input: Record<string, unknown> = {}): SpjArchiveQuery {
  const first = (value: unknown) => Array.isArray(value) ? value[0] : value;
  const search = String(first(input.search) ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
  const pageValue = String(first(input.page) ?? "1");
  const page = /^\d{1,9}$/.test(pageValue) ? Math.max(1, Number(pageValue)) : 1;
  const size = Number(first(input.pageSize));
  const pageSize = SPJ_ARCHIVE_PAGE_SIZES.some(value => value === size) ? size : 20;
  return { search, page, pageSize };
}
