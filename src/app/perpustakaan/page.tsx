import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, LibraryBig, ArrowUpRight } from "lucide-react";
import { LibraryCatalog } from "@/components/library/catalog";
import { Portal } from "@/components/news/public-news";
import s from "@/components/news/public-glass.module.css";
import { getPublicLibraryBooks } from "@/lib/library";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Perpustakaan DKPP", description: "Katalog buku Perpustakaan Dinas Ketahanan Pangan dan Pertanian Kabupaten Indramayu. Cari koleksi dan lihat ketersediaan buku." };
const count = new Intl.NumberFormat("id-ID");
export default async function PublicLibraryPage() {
  const books = await getPublicLibraryBooks();
  const total = books.reduce((n,b) => n + b.copies, 0), available = books.reduce((n,b) => n + b.available, 0);
  return <Portal redesigned><main id="isi" tabIndex={-1}>
    <section className={s.libraryHero} aria-labelledby="library-title"><div className={s.libraryInner}>
      <div><p className={s.kicker}><LibraryBig size={16} aria-hidden/> Perpustakaan DKPP · Indramayu</p><h1 id="library-title">Ruang baca untuk pengetahuan yang tumbuh.</h1><p>Temukan buku pertanian, peternakan, dan bacaan lainnya. Cek ketersediaan sebelum berkunjung.</p><a href="#katalog" className={`${s.primary} mt-5`}><BookOpen size={16} aria-hidden/> Jelajahi koleksi</a></div>
      <aside className={`${s.glass} ${s.collection}`} aria-labelledby="collection-title"><h2 id="collection-title"><LibraryBig size={19} aria-hidden/> Ringkasan koleksi</h2><dl>
        <div><dt>Entri buku</dt><dd>{count.format(books.length)}</dd></div><div><dt>Eksemplar</dt><dd>{count.format(total)}</dd></div><div><dt>Tersedia</dt><dd>{count.format(available)}</dd></div>
      </dl><p>Pendaftaran pengunjung dan peminjaman dilayani oleh petugas perpustakaan.</p><Link href="/#kontak">Hubungi petugas <ArrowUpRight size={15} aria-hidden/></Link></aside>
    </div></section>
    <div id="katalog" className={s.catalogBand}><LibraryCatalog books={books}/></div>
  </main></Portal>;
}
