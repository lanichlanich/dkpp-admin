import { requireMenuAccess } from "@/lib/authorization";
import { listNewsTerms, type NewsTermKind } from "@/lib/news";
import { NewsOperation } from "./news-operation";

export async function NewsTermsPage({ kind }: { kind: NewsTermKind }) {
  await requireMenuAccess("berita");
  const terms = await listNewsTerms(kind);
  const label = kind === "category" ? "kategori" : "tag";
  const title = kind === "category" ? "Kategori" : "Tag";
  const input = "min-h-11 max-w-full rounded-md border bg-background px-3 text-sm";
  return <main className="mx-auto max-w-5xl space-y-5">
    <header><h1 className="text-3xl font-bold">{title} Berita</h1><p className="text-sm text-muted-foreground">{kind === "category" ? "Kelompok utama berita. Setiap berita memiliki satu kategori." : "Topik lintas kategori. Setiap berita dapat memiliki beberapa tag."}</p></header>
    <section className="rounded-xl border bg-card p-4"><h2 className="mb-3 font-semibold">Tambah {label}</h2><NewsOperation fields={{operation:"saveTerm",kind}} label="Tambah"><input aria-label={`Nama ${label} baru`} name="name" required maxLength={60} className={input} placeholder={`Nama ${label}`} /></NewsOperation></section>
    <section className="rounded-xl border bg-card"><h2 className="border-b p-4 font-semibold">Daftar {label}</h2>{!terms.length ? <p className="p-4 text-sm text-muted-foreground">Belum ada {label}.</p> : <ul className="divide-y">{terms.map(term => <li key={`${term.id}:${term.name}`} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="break-all font-semibold">{term.name}</p><p className="text-sm text-muted-foreground">{term.usage} berita{term.id === "default" ? " · Kategori bawaan" : ""}</p></div>{term.id !== "default" && <div className="flex flex-wrap items-start gap-2"><NewsOperation fields={{operation:"saveTerm",kind,id:term.id,previousName:term.name}} label="Simpan nama"><input aria-label={`Nama baru untuk ${term.name}`} name="name" required maxLength={60} className={input} defaultValue={term.name} /></NewsOperation>{(kind === "tag" || !term.usage) && <NewsOperation danger fields={{operation:"deleteTerm",kind,id:term.id}} confirm={`Hapus ${label} “${term.name}”? Berita tidak akan dihapus.`} label="Hapus" />}</div>}</li>)}</ul>}</section>
  </main>;
}
