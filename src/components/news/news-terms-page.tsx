import { FolderOpen, Tags } from "lucide-react";
import { NewsListHeader } from "./news-list-header";
import { requireMenuAccess } from "@/lib/authorization";
import { listNewsTerms, type NewsTermKind } from "@/lib/news";
import { TermDirectory } from "./news-directory";
import { NewsTermDialog } from "./news-term-dialog";

export async function NewsTermsPage({ kind }: { kind: NewsTermKind }) {
  await requireMenuAccess("berita");
  const terms = await listNewsTerms(kind);
  const title = kind === "category" ? "Kategori" : "Tag";
  return <main className="mx-auto min-w-0 max-w-5xl space-y-5">
    <NewsListHeader icon={kind === "category" ? FolderOpen : Tags} tone={kind === "category" ? "indigo" : "violet"} title={`${title} Berita`} description={kind === "category" ? "Setiap berita memiliki satu kategori utama." : "Gunakan beberapa tag untuk menandai topik sebuah berita."} >
      <NewsTermDialog kind={kind} />
    </NewsListHeader>
    <TermDirectory terms={terms} kind={kind} />
  </main>;
}
