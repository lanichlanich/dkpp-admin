import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, LibraryBig, ArrowUpRight } from "lucide-react";
import { LibraryCatalog } from "@/components/library/catalog";
import { getPublicLibraryBooks } from "@/lib/library";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Perpustakaan DKPP", description: "Katalog buku Perpustakaan Dinas Ketahanan Pangan dan Pertanian Kabupaten Indramayu. Cari koleksi dan lihat ketersediaan buku." };
export default async function PublicLibraryPage() {
  const books = await getPublicLibraryBooks();
  const total = books.reduce((n,b) => n + b.copies, 0), available = books.reduce((n,b) => n + b.available, 0);
  return <main className="min-h-screen bg-[#f6f8f5] text-zinc-900">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-8"><Link href="/perpustakaan" className="flex items-center gap-3"><Image src="/dkpp-admin-logo.png" width={46} height={46} alt="Logo DKPP" /><span><span className="block text-base font-semibold">Perpustakaan DKPP</span><span className="text-xs text-zinc-500">Kabupaten Indramayu</span></span></Link><Link href="/login" className="flex items-center gap-1 text-sm font-medium text-emerald-800">Masuk admin <ArrowUpRight className="size-4" /></Link></div></header>
    <section className="relative overflow-hidden bg-emerald-950 text-white"><div className="absolute -top-36 -right-20 size-[500px] rounded-full border-[80px] border-emerald-900/60" aria-hidden /><div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1fr_340px] md:px-8 md:py-20"><div><p className="text-sm font-medium text-emerald-200">Dinas Ketahanan Pangan dan Pertanian</p><h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">Ruang baca untuk<br />pengetahuan yang tumbuh.</h1><p className="mt-5 max-w-xl text-base leading-7 text-emerald-100/80">Jelajahi koleksi Perpustakaan DKPP. Temukan buku pertanian, peternakan, dan bacaan lainnya, lalu cek ketersediaannya sebelum berkunjung.</p><a href="#katalog" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-semibold text-emerald-950"><BookOpen className="size-4" />Jelajahi koleksi</a></div>
    <div className="self-center rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur"><LibraryBig className="size-8 text-amber-300" /><dl className="mt-6 grid grid-cols-3 gap-4"><div><dt className="text-xs text-emerald-200">Entri buku</dt><dd className="mt-2 text-3xl font-semibold">{books.length}</dd></div><div><dt className="text-xs text-emerald-200">Eksemplar</dt><dd className="mt-2 text-3xl font-semibold">{total}</dd></div><div><dt className="text-xs text-emerald-200">Tersedia</dt><dd className="mt-2 text-3xl font-semibold">{available}</dd></div></dl><p className="mt-6 border-t border-white/15 pt-4 text-sm leading-6 text-emerald-100/80">Untuk pendaftaran pengunjung dan peminjaman buku, silakan hubungi petugas perpustakaan.</p></div>
    </div></section>
    <div id="katalog" className="mx-auto max-w-7xl scroll-mt-6 px-5 py-10 md:px-8 md:py-14"><LibraryCatalog books={books} /></div><footer className="border-t bg-white px-5 py-7 text-center text-sm text-zinc-500">Perpustakaan DKPP Kabupaten Indramayu</footer>
  </main>;
}
