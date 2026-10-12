import { z } from "zod";
import type { KakHistory } from "@/lib/kak-types";

export type KakArchiveQuery = { q: string; year: string; from: string; to: string; page: number; pageSize: number };
export type KakArchivePage = { items: KakHistory[]; total: number; totalPages: number; years: number[]; query: KakArchiveQuery };
type SearchParams = Record<string, string | string[] | undefined>;
export function parseKakArchiveQuery(params: SearchParams): KakArchiveQuery {
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const date = (key: string) => z.iso.date().safeParse(value(key)).success ? value(key) : "";
  const year = value("tahun");
  const page = Number(value("halaman"));
  const pageSize = Number(value("perHalaman"));
  return {
    q: value("q").trim().slice(0, 200),
    year: /^\d{4}$/.test(year) && Number(year) >= 2000 && Number(year) <= 2100 ? year : "",
    from: date("dari"), to: date("sampai"),
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 1000000) : 1,
    pageSize: [10, 25, 50].includes(pageSize) ? pageSize : 10,
  };
}
export function kakArchiveUrl(query: KakArchiveQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.year) params.set("tahun", query.year);
  if (query.from) params.set("dari", query.from);
  if (query.to) params.set("sampai", query.to);
  if (query.page > 1) params.set("halaman", String(query.page));
  if (query.pageSize !== 10) params.set("perHalaman", String(query.pageSize));
  return `/dashboard/pembuatan-kak${params.size ? `?${params}` : ""}`;
}
