import type { Metadata } from "next";
import { NewsHome, publicNews } from "@/components/news/public-news";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "DKPP Kabupaten Indramayu" },
  description: "Portal informasi dan berita Dinas Ketahanan Pangan dan Pertanian Kabupaten Indramayu.",
};
export default async function HomePage() {
  return <NewsHome entries={await publicNews.list()} />;
}
