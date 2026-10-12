"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LoaderCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DownloadLinks, ReferenceList } from "@/components/kak/document-links";
import { formatKakRupiah } from "@/lib/kak-types";
import { kakArchiveUrl, type KakArchivePage, type KakArchiveQuery } from "@/lib/kak-archive";

export function KakArchive({ archive }: { archive: KakArchivePage }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useState(archive.query);
  const { items, total, totalPages, query, years } = archive;
  const navigate = (next: KakArchiveQuery) => startTransition(() => router.push(kakArchiveUrl(next), { scroll: false }));
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); navigate({ ...filters, q: filters.q.trim(), page: 1 }); };
  const pages = [...new Set([1, totalPages, query.page - 2, query.page - 1, query.page, query.page + 1, query.page + 2])].filter(page => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const selectClass = "h-10 w-full rounded-lg border bg-background px-3 text-sm";
  return <Card id="arsip-po-kak">
    <CardHeader><CardTitle>Arsip PO dan KAK</CardTitle><CardDescription>Unduh kembali PO, KAK, dan RKA sumber. Periksa isian sebelum dokumen ditetapkan.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <form onSubmit={submit}>
        <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="kak-search">Cari arsip PO/KAK</Label><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="kak-search" value={filters.q} onChange={event => setFilters({ ...filters, q: event.target.value })} maxLength={200} placeholder="Nama, kode sub kegiatan, RKA, atau pembuat..." className="h-10 pl-9" /></div></div>
          <div className="space-y-2"><Label htmlFor="kak-year-filter">Tahun anggaran</Label><select id="kak-year-filter" className={selectClass} value={filters.year} onChange={event => setFilters({ ...filters, year: event.target.value })}><option value="">Semua tahun</option>{[...new Set([...years, ...(query.year ? [Number(query.year)] : [])])].sort((a, b) => b - a).map(year => <option key={year} value={year}>{year}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="kak-date-from">Dibuat sejak</Label><Input id="kak-date-from" type="date" value={filters.from} max={filters.to || undefined} onChange={event => setFilters({ ...filters, from: event.target.value })} className="h-10" /></div>
          <div className="space-y-2"><Label htmlFor="kak-date-to">Dibuat sampai</Label><Input id="kak-date-to" type="date" value={filters.to} min={filters.from || undefined} onChange={event => setFilters({ ...filters, to: event.target.value })} className="h-10" /></div>
          <div className="space-y-2"><Label htmlFor="kak-page-size">Baris per halaman</Label><select id="kak-page-size" className={selectClass} value={filters.pageSize} onChange={event => { const next = { ...filters, pageSize: Number(event.target.value), page: 1 }; setFilters(next); navigate(next); }}>{[10, 25, 50].map(size => <option key={size} value={size}>{size} baris</option>)}</select></div>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-6"><Button type="submit">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}Cari / Terapkan filter</Button><Button type="button" variant="outline" onClick={() => navigate({ q: "", year: "", from: "", to: "", page: 1, pageSize: 10 })}>Reset filter</Button></div>
        </fieldset>
      </form>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{pending ? "Memuat arsip..." : `Menampilkan ${total ? (query.page - 1) * query.pageSize + 1 : 0}–${Math.min(query.page * query.pageSize, total)} dari ${total} arsip`}</p>
      <div className="overflow-x-auto" aria-busy={pending}>
        <table className="w-full text-left text-sm"><thead><tr className="border-b text-zinc-500"><th className="p-3">Sub kegiatan</th><th className="p-3">TA / Pagu</th><th className="p-3">Dibuat</th><th className="p-3">Unduh</th></tr></thead>
          <tbody>{items.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-zinc-500">{query.q || query.year || query.from || query.to ? "Tidak ada arsip yang sesuai pencarian atau filter." : "Belum ada arsip PO dan KAK."}</td></tr>}
            {items.map(h => <tr key={h.id} className="border-b align-top"><td className="min-w-64 p-3"><p className="font-medium">{h.subKegiatan}</p><p className="text-xs text-zinc-500">{h.kodeSubKegiatan}</p>{h.nomorUrutSubKegiatan && <p className="mt-1 text-xs text-zinc-500">Nomor urut cover: {h.nomorUrutSubKegiatan}</p>}<ReferenceList references={[...(h.references || []), ...(h.nomorUrutReference ? [h.nomorUrutReference] : [])]} />{h.warnings.length > 0 && <details className="mt-2 text-xs text-amber-800"><summary className="cursor-pointer">Catatan pemeriksaan</summary><ul className="mt-2 list-disc space-y-1 pl-4">{h.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}</td><td className="whitespace-nowrap p-3">{h.tahunAnggaran}<p>{formatKakRupiah(h.paguAnggaran)}</p></td><td className="whitespace-nowrap p-3">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(h.createdAt))}<p className="text-xs text-zinc-500">{h.createdBy}</p></td><td className="space-y-2 whitespace-nowrap p-3"><DownloadLinks id={h.id} hasPo={Boolean(h.poFileName)} />{!h.poFileName && <p className="text-xs text-zinc-500">Arsip KAK lama; PO belum tersedia.</p>}</td></tr>)}
          </tbody>
        </table>
      </div>
      <nav aria-label="Pagination arsip PO dan KAK" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Halaman {query.page} dari {totalPages}</p>
        <div className="flex flex-wrap items-center gap-1"><Button type="button" variant="outline" disabled={pending || query.page === 1} onClick={() => navigate({ ...query, page: query.page - 1 })}><ChevronLeft />Sebelumnya</Button>{pages.map((page, index) => <span key={page} className="inline-flex items-center gap-1">{index > 0 && page > pages[index - 1] + 1 && <span className="px-1 text-muted-foreground">…</span>}<Button type="button" size="icon" variant={page === query.page ? "default" : "outline"} aria-label={`Halaman ${page}`} aria-current={page === query.page ? "page" : undefined} disabled={pending} onClick={() => navigate({ ...query, page })}>{page}</Button></span>)}<Button type="button" variant="outline" disabled={pending || query.page === totalPages} onClick={() => navigate({ ...query, page: query.page + 1 })}>Berikutnya<ChevronRight /></Button></div>
      </nav>
    </CardContent>
  </Card>;
}
