"use client";

import { useMemo, useState } from "react";
import { Copy, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { classificationGroups, classificationSource, letterClassifications, searchLetterClassifications } from "@/lib/letter-classification";

const pageSize = 50;
export function ClassificationBrowser() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [page, setPage] = useState(0);
  const results = useMemo(() => searchLetterClassifications(query, group), [query, group]);
  const pages = Math.max(1, Math.ceil(results.length / pageSize));
  async function copyCode(code: string) {
    try { await navigator.clipboard.writeText(code); toast.success(`Kode ${code} disalin.`); }
    catch { toast.error("Kode tidak dapat disalin. Pilih teks kode untuk menyalinnya secara manual."); }
  }
  return <Card>
    <CardHeader className="border-b"><CardTitle>{letterClassifications.length.toLocaleString("id-ID")} kode klasifikasi</CardTitle>
      <CardDescription>Dasar: {classificationSource.title}, tanggal 2 Februari 2023. Pilih berdasarkan isi surat; saran di form dapat disesuaikan.</CardDescription>
      <a href={classificationSource.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 underline underline-offset-4"><ExternalLink className="size-4" />Buka PDF dasar klasifikasi</a>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1fr_280px]"><div className="space-y-2"><Label htmlFor="classification-search">Cari kode atau uraian</Label><div className="relative"><Search className="absolute left-3 top-3 size-4 text-zinc-400" /><Input id="classification-search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Contoh: 800.1.11.13, gaji berkala, pertanian..." className="h-10 pl-9" /></div></div>
        <div className="space-y-2"><Label htmlFor="classification-group">Kelompok urusan</Label><select id="classification-group" value={group} onChange={(event) => { setGroup(event.target.value); setPage(0); }} className="h-10 w-full rounded-lg border bg-background px-3 text-sm"><option value="">Semua kelompok</option>{classificationGroups.map((entry) => <option key={entry.code} value={entry.code}>{entry.code} — {entry.label}</option>)}</select></div></div>
      <p role="status" className="text-sm text-zinc-500">{results.length.toLocaleString("id-ID")} hasil pencarian.</p>
      {results.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">Tidak ada klasifikasi yang cocok. Coba kata kunci lain.</p> :
        <div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-zinc-50 text-zinc-500"><tr><th className="px-4 py-3">Kode</th><th className="px-4 py-3">Uraian dan kelompok</th><th className="px-4 py-3">Sumber</th><th className="px-4 py-3"><span className="sr-only">Salin kode</span></th></tr></thead><tbody className="divide-y">{results.slice(page * pageSize, (page + 1) * pageSize).map((entry) => <tr key={entry.code} className="align-top"><td className="whitespace-nowrap px-4 py-3 font-semibold text-emerald-800">{entry.code}</td><td className="min-w-60 px-4 py-3"><p>{entry.label}</p>{entry.path && <p className="mt-1 text-xs leading-5 text-zinc-500">{entry.path}</p>}</td><td className="whitespace-nowrap px-4 py-3"><a href={`${classificationSource.url}#page=${entry.page}`} target="_blank" rel="noreferrer" className="text-emerald-700 underline">Hal. {entry.page}</a></td><td className="px-4 py-3"><Button variant="ghost" size="icon" type="button" aria-label={`Salin kode ${entry.code}`} onClick={() => copyCode(entry.code)}><Copy className="size-4" /></Button></td></tr>)}</tbody></table></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-zinc-500">Halaman {page + 1} dari {pages}</span><div className="flex gap-2"><Button variant="outline" type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button><Button variant="outline" type="button" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button></div></div>
    </CardContent>
  </Card>;
}
