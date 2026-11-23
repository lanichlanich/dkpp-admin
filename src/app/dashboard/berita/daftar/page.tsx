import Link from "next/link";
import { requireMenuAccess } from "@/lib/authorization";
import { listNews } from "@/lib/news";
import { NewsOperation } from "@/components/news/news-operation";

export const metadata = { title: "Daftar Berita" };
const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });

export default async function NewsList({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireMenuAccess("berita");
  const [query, articles] = await Promise.all([searchParams, listNews()]);
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 160) : "";
  const status = ["draft", "published"].includes(query.status ?? "") ? query.status : "";
  const filtered = articles.filter(article => (!status || article.status === status) && (!q || `${article.title} ${article.category}`.toLowerCase().includes(q.toLowerCase())));
  return <main className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">Daftar Berita</h1><p className="text-sm text-muted-foreground">Kelola draf dan berita yang tampil di portal publik.</p></div><Link href="/dashboard/berita/buat" className="rounded-md bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900">+ Buat Berita</Link></header>
    <form className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-4">
      <label className="grid min-w-0 flex-1 gap-1 text-sm font-semibold">Cari berita<input name="q" defaultValue={q} maxLength={160} placeholder="Judul atau kategori" className="min-h-11 min-w-0 rounded-md border bg-background px-3 font-normal" /></label>
      <label className="grid gap-1 text-sm font-semibold">Status<select name="status" defaultValue={status} className="min-h-11 rounded-md border bg-background px-3 font-normal"><option value="">Semua</option><option value="draft">Draf</option><option value="published">Terbit</option></select></label>
      <button className="min-h-11 rounded-md border px-4 text-sm font-semibold hover:bg-muted">Terapkan</button>
    </form>
    <section aria-label="Hasil pencarian" className="rounded-xl border bg-card">
      <p className="border-b px-4 py-3 text-sm text-muted-foreground">{filtered.length} dari {articles.length} berita</p>
      {!filtered.length ? <p className="p-5 text-sm text-muted-foreground">{articles.length ? "Tidak ada berita yang cocok dengan filter." : "Belum ada berita redaksi. Mulai dengan membuat draf pertama."}</p> : <ul className="divide-y">{filtered.map(article => <li key={article.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0"><h2 className="break-words font-semibold"><Link className="hover:underline" href={`/dashboard/berita/buat?edit=${encodeURIComponent(article.id)}`}>{article.title}</Link></h2><p className="mt-1 text-xs text-muted-foreground"><span className={article.status === "published" ? "font-semibold text-emerald-700 dark:text-emerald-300" : "font-semibold"}>{article.status === "published" ? "Terbit" : "Draf"}</span> · {article.category} · {date.format(new Date(article.updatedAt))}</p></div>
        <div className="flex flex-wrap items-start gap-2 text-sm">{article.status === "published" && <Link className="rounded-md border px-3 py-3 hover:bg-muted" href={`/berita/${article.slug}`}>Lihat</Link>}<Link className="rounded-md border px-3 py-3 hover:bg-muted" href={`/dashboard/berita/buat?edit=${encodeURIComponent(article.id)}`}>Edit</Link><NewsOperation danger fields={{operation:"deleteArticle",id:article.id,revision:String(article.revision)}} confirm={`Hapus permanen “${article.title}”? Berita yang sudah terbit juga akan hilang dari portal.`} label="Hapus" /></div>
      </li>)}</ul>}
    </section>
  </main>;
}
