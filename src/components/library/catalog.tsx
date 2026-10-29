"use client";
import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { PublicLibraryBook } from "@/lib/library-types";

export function LibraryCatalog({ books }: { books: PublicLibraryBook[] }) {
  const [search, setSearch] = useState(""), [category, setCategory] = useState(""), [availableOnly, setAvailableOnly] = useState(false), [page, setPage] = useState(1);
  const categories = [...new Set(books.map(b => b.category.toLocaleLowerCase("id-ID")).filter(Boolean))].sort((a,b) => a.localeCompare(b, "id"));
  const filtered = useMemo(() => books.filter(b => (!category || b.category.toLocaleLowerCase("id-ID") === category) && (!availableOnly || b.available > 0)
    && `${b.title} ${b.inventoryCode} ${b.isbn} ${b.publisher}`.toLocaleLowerCase("id-ID").includes(search.toLocaleLowerCase("id-ID"))), [books, category, availableOnly, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / 12)), current = Math.min(page, pages);
  return <section aria-labelledby="catalog-heading" className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-medium text-emerald-700">Temukan bacaan Anda</p><h2 id="catalog-heading" className="mt-1 text-2xl font-semibold tracking-tight">Katalog buku</h2></div><p className="text-sm text-zinc-500">{filtered.length} entri ditemukan</p></div>
    <div className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-[1fr_240px_auto]">
      <div className="relative"><Search className="absolute top-3 left-3 size-4 text-zinc-400" /><Input aria-label="Cari buku" className="h-10 pl-10" placeholder="Cari judul, pengarang, ISBN, atau kode inventaris…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
      <select aria-label="Kategori buku" className="h-10 rounded-lg border bg-white px-3 text-sm capitalize" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="">Semua kategori</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
      <label className="flex items-center gap-2 px-2 text-sm"><input type="checkbox" checked={availableOnly} onChange={e => { setAvailableOnly(e.target.checked); setPage(1); }} />Tersedia saja</label>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.slice((current - 1) * 12, current * 12).map(book => <article key={book.id} className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-emerald-50/70 px-5 py-4"><BookOpen aria-hidden className="size-6 text-emerald-700" /><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${book.available > 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{book.available > 0 ? `${book.available} tersedia` : book.copies > 0 ? "Sedang dipinjam" : "Belum tersedia"}</span></div>
      <div className="flex flex-1 flex-col p-5"><p className="text-xs text-zinc-500 capitalize">{book.category || "Umum"}</p><h3 className="mt-2 text-base font-semibold leading-6 text-zinc-900">{book.title}</h3><p className="mt-3 text-sm text-zinc-500">{book.publisher && book.publisher !== "-" ? book.publisher : "Penerbit belum tercatat"}{book.publicationYear && book.publicationYear !== "-" ? ` · ${book.publicationYear}` : ""}</p>
        <details className="mt-auto pt-5 text-sm"><summary className="cursor-pointer font-medium text-emerald-700">Detail buku</summary><dl className="mt-3 space-y-2 text-zinc-600"><div><dt className="inline font-medium">Kode inventaris: </dt><dd className="inline break-all">{book.inventoryCode}</dd></div><div><dt className="inline font-medium">ISBN/ISSN: </dt><dd className="inline">{book.isbn || "-"}</dd></div><div><dt className="inline font-medium">Tempat terbit: </dt><dd className="inline">{book.publicationPlace || "-"}</dd></div><div><dt className="inline font-medium">Eksemplar: </dt><dd className="inline">{book.copies} total, {book.borrowed} dipinjam</dd></div><div><dt className="inline font-medium">Rak: </dt><dd className="inline">{book.shelf || "Hubungi petugas"}</dd></div></dl></details>
      </div>
    </article>)}</div>
    {filtered.length === 0 && <p className="rounded-2xl border border-dashed p-12 text-center text-zinc-500">Tidak ada buku yang cocok. Coba kata kunci atau kategori lain.</p>}
    <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={current <= 1} onClick={() => setPage(current - 1)}>Sebelumnya</Button><p className="text-sm text-zinc-500">Halaman {current} dari {pages}</p><Button variant="outline" disabled={current >= pages} onClick={() => setPage(current + 1)}>Berikutnya</Button></div>
  </section>;
}
