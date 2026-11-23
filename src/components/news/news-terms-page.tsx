import { FolderOpen, Tags } from "lucide-react";
import { NewsListHeader } from "./news-list-header";
import { requireMenuAccess } from "@/lib/authorization";
import { listNewsTerms, type NewsTermKind } from "@/lib/news";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TermDirectory } from "./news-directory";
import { NewsOperation } from "./news-operation";

export async function NewsTermsPage({ kind }: { kind: NewsTermKind }) {
  await requireMenuAccess("berita");
  const terms = await listNewsTerms(kind);
  const label = kind === "category" ? "kategori" : "tag";
  const title = kind === "category" ? "Kategori" : "Tag";
  return <main className="mx-auto min-w-0 max-w-5xl space-y-5">
    <NewsListHeader icon={kind === "category" ? FolderOpen : Tags} tone={kind === "category" ? "indigo" : "violet"} title={`${title} Berita`} description={kind === "category" ? "Setiap berita memiliki satu kategori utama." : "Gunakan beberapa tag untuk menandai topik sebuah berita."} />
    <Card><CardHeader><CardTitle>Tambah {label}</CardTitle></CardHeader><CardContent>
      <NewsOperation fields={{ operation: "saveTerm", kind }} label="Tambah"><Input aria-label={`Nama ${label} baru`} name="name" required maxLength={60} className="w-52 max-w-full" placeholder={`Nama ${label}`} /></NewsOperation>
    </CardContent></Card>
    <TermDirectory terms={terms} kind={kind} />
  </main>;
}
