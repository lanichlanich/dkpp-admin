import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMenuAccess } from "@/lib/authorization";
import { getNewsForEdit, getNewsTagIds, listNewsTerms } from "@/lib/news";
import { NewsEditor } from "@/components/news/news-editor";

export const metadata = { title: "Editor Berita" };
export default async function EditPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireMenuAccess("berita");
  const { edit } = await searchParams;
  const id = typeof edit === "string" ? edit : "";
  const [article, categories, tags, selectedTags] = await Promise.all([id ? getNewsForEdit(id) : undefined, listNewsTerms("category"), listNewsTerms("tag"), id ? getNewsTagIds(id) : []]);
  if (id && !article) notFound();
  return <div className="mx-auto max-w-5xl space-y-5">
    <Link href="/dashboard/berita/daftar" className="inline-flex min-h-11 items-center text-sm font-semibold underline">← Daftar Berita</Link>
    <header><h1 className="text-3xl font-bold">{article ? "Edit Berita" : "Buat Berita"}</h1><p className="text-sm text-muted-foreground">{article ? (article.status === "published" ? "Terbit di portal publik" : "Draf · belum tampil di portal") : "Susun berita dan simpan sebagai draf atau langsung terbitkan."}</p></header>
    <NewsEditor key={article ? `${article.id}:${article.revision}` : "new"} article={article} categories={categories} tags={tags} selectedTags={selectedTags} />
  </div>;
}
