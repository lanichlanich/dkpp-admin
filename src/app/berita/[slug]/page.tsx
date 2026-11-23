import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { NewsDetail, publicNews } from "@/components/news/public-news";

export const dynamic = "force-dynamic";
const getNews = cache(publicNews.get);
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await getNews((await params).slug);
  return result ? { title: { absolute: `${result.article.title} | DKPP Indramayu` }, description: result.article.summary, ...(result.isSample ? {robots:{index:false,follow:true}} : {}) } : {};
}
export default async function ArticlePage({ params }: Props) {
  const result = await getNews((await params).slug);
  if (!result) notFound();
  return <NewsDetail entry={result}/>;
}
