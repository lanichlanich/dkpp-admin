"use client";

import { useMemo } from "react";
import { Eye, FilePenLine, FolderOpen, Pencil, Radio, Tag } from "lucide-react";
import Link from "next/link";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NewsArticle, NewsTerm, NewsTermKind } from "@/lib/news";
import { NewsDataTable, type NewsTableFilter } from "./news-data-table";
import { NewsOperation } from "./news-operation";

export type ArticleListRow = Pick<NewsArticle, "id" | "slug" | "title" | "category" | "status" | "updatedAt" | "revision">;
const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });
const day = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" });
const statuses = [{ value: "Draf", label: "Draf" }, { value: "Terbit", label: "Terbit" }];
const editUrl = (id: string) => `/dashboard/berita/buat?edit=${encodeURIComponent(id)}`;
const outline = buttonVariants({ variant: "outline" });
const articleColumns: LegacyColumnDef<ArticleListRow>[] = [
  { accessorKey: "title", header: "Judul", filterFn: "includesString", cell: ({ row }) => <Link className="block min-w-44 max-w-md font-medium whitespace-normal break-words hover:underline" href={editUrl(row.original.id)}>{row.original.title}</Link> },
  { accessorKey: "category", header: "Kategori", filterFn: "equalsString", cell: ({ row }) => <Badge variant="outline" className="bg-indigo-500/10 text-indigo-800 dark:text-indigo-300"><FolderOpen aria-hidden/>{row.original.category}</Badge> },
  { id: "status", accessorFn: article => article.status === "published" ? "Terbit" : "Draf", header: "Status", filterFn: "equalsString", cell: ({ row, getValue }) => <Badge variant="outline" className={row.original.status === "published" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300"}>{row.original.status === "published" ? <Radio aria-hidden/> : <FilePenLine aria-hidden/>}{String(getValue())}</Badge> },
  { accessorKey: "updatedAt", header: "Diperbarui", enableGlobalFilter: false, filterFn: (row, _, value) => day.format(new Date(row.original.updatedAt)) === value, cell: ({ row }) => date.format(new Date(row.original.updatedAt)) },
  { id: "actions", header: "Aksi", cell: ({ row: { original: article } }) => <div className="flex items-start gap-2">
    {article.status === "published" && <Link className={outline} href={`/berita/${article.slug}`}><Eye aria-hidden/> Lihat</Link>}
    <Link className={outline} href={editUrl(article.id)}><Pencil aria-hidden/> Edit</Link>
    <NewsOperation danger fields={{ operation: "deleteArticle", id: article.id, revision: String(article.revision) }} confirm={`Hapus permanen “${article.title}”? Berita yang sudah terbit juga akan hilang dari portal.`} label="Hapus" />
  </div> },
];

export function ArticleDirectory({ articles, query, status }: { articles: ArticleListRow[]; query: string; status: string }) {
  const filters: NewsTableFilter[] = [
    { id: "title", label: "Judul" },
    { id: "category", label: "Kategori", options: Array.from(new Set(articles.map(article => article.category))).sort((a, b) => a.localeCompare(b, "id")).map(value => ({ value, label: value })) },
    { id: "status", label: "Status", options: statuses },
    { id: "updatedAt", label: "Tanggal diperbarui", type: "date" },
  ];
  const initialFilters = status ? [{ id: "status", value: status }] : [];
  return <NewsDataTable data={articles} columns={articleColumns} filters={filters} label="Daftar Berita" initialSearch={query} initialFilters={initialFilters} />;
}

const termFilters: NewsTableFilter[] = [
  { id: "name", label: "Nama" },
  { id: "usage", label: "Penggunaan", options: [{ value: "used", label: "Dipakai" }, { value: "unused", label: "Belum dipakai" }] },
];
export function TermDirectory({ terms, kind }: { terms: NewsTerm[]; kind: NewsTermKind }) {
  const label = kind === "category" ? "Kategori" : "Tag";
  const TermIcon = kind === "category" ? FolderOpen : Tag;
  const columns = useMemo<LegacyColumnDef<NewsTerm>[]>(() => [
    { accessorKey: "name", header: "Nama", filterFn: "includesString", cell: ({ row }) => <span className="inline-flex flex-wrap items-center gap-2 font-medium"><TermIcon aria-hidden className={kind === "category" ? "size-4 text-indigo-600 dark:text-indigo-300" : "size-4 text-violet-600 dark:text-violet-300"}/>{row.original.name}{row.original.id === "default" && <Badge variant="secondary">Bawaan</Badge>}</span> },
    { accessorKey: "usage", header: "Jumlah berita", enableGlobalFilter: false, filterFn: (row, _, value) => (row.original.usage > 0) === (value === "used"), cell: ({ row }) => <Badge variant="outline" className={row.original.usage ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-muted text-muted-foreground"}>{row.original.usage} berita</Badge> },
    { id: "actions", header: "Aksi", cell: ({ row: { original: term } }) => term.id === "default" ? <span className="text-muted-foreground">—</span> : <div className="flex items-start gap-2" key={term.name}>
      <NewsOperation fields={{ operation: "saveTerm", kind, id: term.id, previousName: term.name }} label="Simpan nama"><Input aria-label={`Nama baru untuk ${term.name}`} name="name" required maxLength={60} defaultValue={term.name} className="w-36"/></NewsOperation>
      {(kind === "tag" || !term.usage) && <NewsOperation danger fields={{ operation: "deleteTerm", kind, id: term.id }} confirm={`Hapus ${label.toLowerCase()} “${term.name}”? Berita tidak akan dihapus.`} label="Hapus" />}
    </div> },
  ], [kind, label, TermIcon]);
  return <NewsDataTable data={terms} columns={columns} filters={termFilters} label={label} />;
}
