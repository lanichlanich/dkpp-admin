import Link from "next/link";
import { requireMenuAccess } from "@/lib/authorization";
import { listNews } from "@/lib/news";
import { ArticleDirectory } from "@/components/news/news-directory";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Daftar Berita" };
export default async function NewsList({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireMenuAccess("berita");
  const [query, articles] = await Promise.all([searchParams, listNews()]);
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 160) : "";
  const status = query.status === "published" ? "Terbit" : query.status === "draft" ? "Draf" : "";
  const rows = articles.map(({ id, slug, title, category, status, updatedAt, revision }) => ({ id, slug, title, category, status, updatedAt, revision }));
  return <main className="mx-auto min-w-0 max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">Daftar Berita</h1><p className="text-sm text-muted-foreground">Kelola draf dan berita yang tampil di portal publik.</p></div><Link href="/dashboard/berita/buat" className={buttonVariants({ size: "lg" })}>+ Buat Berita</Link></header>
    <ArticleDirectory key={JSON.stringify([q, status])} articles={rows} query={q} status={status} />
  </main>;
}
