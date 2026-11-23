import { Newspaper, Plus } from "lucide-react";
import { NewsListHeader } from "@/components/news/news-list-header";
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
    <NewsListHeader icon={Newspaper} tone="emerald" title="Daftar Berita" description="Kelola draf dan berita yang tampil di portal publik.">
      <Link href="/dashboard/berita/buat" className={buttonVariants({ size: "lg" })}><Plus aria-hidden/> Buat Berita</Link>
    </NewsListHeader>
    <ArticleDirectory key={JSON.stringify([q, status])} articles={rows} query={q} status={status} />
  </main>;
}
