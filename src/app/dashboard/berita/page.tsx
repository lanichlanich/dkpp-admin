import type { Metadata } from "next";
import Link from "next/link";
import { requireMenuAccess } from "@/lib/authorization";
import { listNews } from "@/lib/news";
import { NewsEditor } from "@/components/news/news-editor";

export const metadata: Metadata = { title: "Berita" };
export default async function NewsDashboard({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireMenuAccess("berita");
  const [{ edit }, articles] = await Promise.all([searchParams, listNews()]);
  const current = articles.find(article => article.id === edit);
  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-5">
      <div><p className="text-xs font-semibold tracking-[.18em] text-emerald-700 dark:text-emerald-400">REDAKSI DKPP</p><h1 className="mt-1 text-3xl font-bold">Berita</h1><p className="mt-1 text-sm text-muted-foreground">Tulis, tinjau, dan terbitkan berita untuk portal publik.</p></div>
      <Link href="/" className="rounded-md border px-4 py-2 text-sm font-semibold">Lihat portal publik ↗</Link>
    </header>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <NewsEditor key={current ? `${current.id}:${current.revision}` : "new"} article={current} />
      <aside className="rounded-xl border bg-card p-4" aria-label="Daftar berita">
        <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold">Daftar berita</h2><Link href="/dashboard/berita" className="text-sm font-medium underline">+ Berita baru</Link></div>
        {articles.length ? <ul className="divide-y">{articles.map(article => <li key={article.id} className="py-3"><Link aria-current={current?.id === article.id ? "page" : undefined} href={`/dashboard/berita?edit=${encodeURIComponent(article.id)}`} className="block break-words text-sm font-semibold hover:underline">{article.title}</Link><p className="mt-1 text-xs text-muted-foreground">{article.status === "published" ? "Terbit" : "Draf"} · {article.category}</p>{article.status === "published" && <Link className="mt-1 inline-block text-xs underline" href={`/berita/${article.slug}`}>Baca di portal</Link>}</li>)}</ul> : <p className="text-sm text-muted-foreground">Belum ada berita redaksi. Artikel contoh tampil di portal hingga berita pertama diterbitkan.</p>}
      </aside>
    </div>
  </div>;
}
