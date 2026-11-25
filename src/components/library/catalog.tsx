"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { PublicLibraryBook } from "@/lib/library-types";
import { libraryCoverUrl } from "@/lib/library-cover-types";
import s from "@/components/news/public-glass.module.css";
import { BookCover } from "./book-cover";

export function LibraryCatalog({ books }: { books: PublicLibraryBook[] }) {
  const [search, setSearch] = useState(""), [category, setCategory] = useState(""), [availableOnly, setAvailableOnly] = useState(false), [page, setPage] = useState(1);
  const categories = [...new Set(books.map(b => b.category.toLocaleLowerCase("id-ID")).filter(Boolean))].sort((a,b) => a.localeCompare(b, "id"));
  const filtered = useMemo(() => books.filter(b => (!category || b.category.toLocaleLowerCase("id-ID") === category) && (!availableOnly || b.available > 0)
    && `${b.title} ${b.inventoryCode} ${b.isbn} ${b.publisher}`.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID"))), [books, category, availableOnly, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / 12)), current = Math.min(page, pages);
  return <section aria-labelledby="catalog-heading" className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-[#3a5429] uppercase">Temukan bacaan Anda</p><h2 id="catalog-heading" className={s.catalogHeading}>Katalog buku</h2></div><p className="text-sm font-semibold text-[#3a5429]" role="status">{filtered.length} entri ditemukan</p></div>
    <div className="grid items-end gap-3 rounded-[18px] border border-[#cdd3c5] bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(145px,.5fr)_auto]">
      <label className="grid min-w-0 gap-1.5 text-sm font-semibold">Cari buku<span className="relative"><Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-[#3a5429]" aria-hidden/><Input type="search" className="h-11 border-[#768777] bg-white pl-9 text-[#0d2638]" placeholder="Judul, penerbit, atau ISBN" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/></span></label>
      <label className="grid min-w-0 gap-1.5 text-sm font-semibold">Kategori<select className="h-11 w-full rounded-lg border border-[#768777] bg-white px-3 text-sm capitalize" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="">Semua kategori</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
      <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[#768777] px-3 text-sm font-semibold"><input type="checkbox" className="size-4 accent-[#3a5429]" checked={availableOnly} onChange={e => { setAvailableOnly(e.target.checked); setPage(1); }}/>Tersedia saja</label>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.slice((current - 1) * 12, current * 12).map(book => <article key={book.id} className="flex flex-col overflow-hidden rounded-[18px] border border-[#cdd3c5] bg-white shadow-sm">
      <div className="grid place-items-center border-b bg-[#edf0e2] px-5 py-5">
        <BookCover src={libraryCoverUrl(book.id, book.coverStorageName)} title={book.title} preview className="w-36 bg-white shadow-sm sm:w-40" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[#46534c] capitalize">{book.category || "Umum"}</p>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${book.available > 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{book.available > 0 ? `${book.available} tersedia` : book.copies > 0 ? "Sedang dipinjam" : "Belum tersedia"}</span>
        </div>
        <h3 className="mt-2 text-base font-semibold leading-6 text-zinc-900">{book.title}</h3><p className="mt-3 text-sm text-[#46534c]">{book.publisher && book.publisher !== "-" ? book.publisher : "Penerbit belum tercatat"}{book.publicationYear && book.publicationYear !== "-" ? ` · ${book.publicationYear}` : ""}</p>
        <details className="mt-auto pt-5 text-sm"><summary className="cursor-pointer py-2 font-semibold text-[#3a5429]">Detail buku</summary><dl className="mt-3 space-y-2 text-zinc-600"><div><dt className="inline font-medium">Kode inventaris: </dt><dd className="inline break-all">{book.inventoryCode}</dd></div><div><dt className="inline font-medium">ISBN/ISSN: </dt><dd className="inline">{book.isbn || "-"}</dd></div><div><dt className="inline font-medium">Tempat terbit: </dt><dd className="inline">{book.publicationPlace || "-"}</dd></div><div><dt className="inline font-medium">Eksemplar: </dt><dd className="inline">{book.copies} total, {book.borrowed} dipinjam</dd></div><div><dt className="inline font-medium">Rak: </dt><dd className="inline">{book.shelf || "Hubungi petugas"}</dd></div></dl></details>
      </div>
    </article>)}</div>
    {filtered.length === 0 && <p className="rounded-2xl border border-dashed p-12 text-center text-[#46534c]">Tidak ada buku yang cocok. Coba kata kunci atau kategori lain.</p>}
    {filtered.length > 0 && <nav aria-label="Halaman katalog" className="flex flex-wrap items-center justify-between gap-2"><Button className="min-h-11" variant="outline" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft aria-hidden/> Sebelumnya</Button><p className="text-sm text-[#46534c]" aria-live="polite">Halaman {current} dari {pages}</p><Button className="min-h-11" variant="outline" disabled={current >= pages} onClick={() => setPage(current + 1)}>Berikutnya <ChevronRight aria-hidden/></Button></nav>}
  </section>;
}
