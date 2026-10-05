"use client";

import { useMemo, useState } from "react";
import { Download, FileText, LoaderCircle, Pencil, Search, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ArchiveDocument } from "@/lib/arsip-dinas";

type MetadataFields = { namaDokumen: string; nomor: string; jenisDokumen: string; tglDokumen: string };
const empty = (today: string): MetadataFields => ({ namaDokumen: "", nomor: "", jenisDokumen: "", tglDokumen: today });
function dateLabel(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)); }
function sizeLabel(size: number) { return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`; }

export function ArsipDinas({ initialDocuments }: { initialDocuments: ArchiveDocument[] }) {
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date());
  const [documents, setDocuments] = useState(initialDocuments);
  const [fields, setFields] = useState<MetadataFields>(() => empty(today));
  const [dateEdited, setDateEdited] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const filtered = useMemo(() => { const q = query.trim().toLocaleLowerCase("id-ID"); return documents.filter((d) => !q || [d.namaDokumen, d.nomor, d.jenisDokumen, d.tglDokumen].some((v) => v.toLocaleLowerCase("id-ID").includes(q))); }, [documents, query]);

  function update<K extends keyof MetadataFields>(key: K, value: MetadataFields[K]) { setFields((current) => ({ ...current, [key]: value })); }
  function chooseFile(next: File | null) {
    if (next && (next.type !== "application/pdf" || !next.name.toLowerCase().endsWith(".pdf"))) { toast.error("Pilih berkas PDF."); return; }
    if (next && next.size > 2 * 1024 * 1024) { toast.error("Ukuran PDF maksimal 2 MB."); return; }
    setFile(next);
  }

  async function readWithGemini() {
    if (!file) { toast.error("Pilih PDF yang akan dibaca terlebih dahulu."); return; }
    setReading(true); setWarnings([]);
    try {
      const form = new FormData(); form.set("kind", "official-archive"); form.set("employeeName", ""); form.set("employeeNip", ""); form.set("documentType", "Arsip dinas"); form.set("file", file);
      const response = await fetch("/api/document-ai/extract", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Dokumen gagal dibaca.");
      const values = payload.values as MetadataFields;
      setFields((current) => ({ namaDokumen: current.namaDokumen || values.namaDokumen || "", nomor: current.nomor || values.nomor || "", jenisDokumen: current.jenisDokumen || values.jenisDokumen || "", tglDokumen: dateEdited ? current.tglDokumen : values.tglDokumen || current.tglDokumen }));
      setWarnings(payload.warnings ?? []);
      toast.success("Pembacaan Gemini selesai. Periksa kembali hasilnya sebelum disimpan.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gemini tidak dapat membaca dokumen. Isi form secara manual."); }
    finally { setReading(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing && !file) { toast.error("Pilih berkas PDF."); return; }
    setSaving(true);
    try {
      let response: Response;
      if (editing) response = await fetch(`/api/arsip-dinas/${editing}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
      else { const form = new FormData(); Object.entries(fields).forEach(([key, value]) => form.set(key, value)); form.set("file", file!); response = await fetch("/api/arsip-dinas", { method: "POST", body: form }); }
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message ?? "Arsip gagal disimpan.");
      if (editing) setDocuments((current) => current.map((item) => item.id === editing ? payload.document : item));
      else setDocuments((current) => [payload.document, ...current]);
      toast.success(editing ? "Metadata arsip diperbarui." : "Arsip dinas berhasil disimpan.");
      setFields(empty(today)); setDateEdited(false); setFile(null); setEditing(null); setWarnings([]);
      const input = document.getElementById("archive-pdf") as HTMLInputElement | null; if (input) input.value = "";
    } catch (error) { toast.error(error instanceof Error ? error.message : "Arsip gagal disimpan."); }
    finally { setSaving(false); }
  }

  function startEdit(doc: ArchiveDocument) { setEditing(doc.id); setFields({ namaDokumen: doc.namaDokumen, nomor: doc.nomor, jenisDokumen: doc.jenisDokumen, tglDokumen: doc.tglDokumen }); setDateEdited(true); setFile(null); setWarnings([]); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function cancelEdit() { setEditing(null); setFields(empty(today)); setDateEdited(false); setFile(null); const input = document.getElementById("archive-pdf") as HTMLInputElement | null; if (input) input.value = ""; }

  return <div className="space-y-6">
    <Card>
      <CardHeader className="border-b"><CardTitle>{editing ? "Edit metadata arsip" : "Tambah arsip dinas"}</CardTitle><CardDescription>PDF maksimal 2 MB. Nama file unduhan akan mengikuti nama dokumen.</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="archive-name">Nama dokumen</Label><Input id="archive-name" value={fields.namaDokumen} onChange={(e) => update("namaDokumen", e.target.value)} placeholder="Contoh: Surat Edaran Jam Kerja" maxLength={180} required disabled={saving} /></div>
            <div className="space-y-2"><Label htmlFor="archive-number">Nomor dokumen <span className="font-normal text-zinc-500">(jika ada)</span></Label><Input id="archive-number" value={fields.nomor} onChange={(e) => update("nomor", e.target.value)} placeholder="Boleh dikosongkan" maxLength={120} disabled={saving} /></div>
            <div className="space-y-2"><Label htmlFor="archive-kind">Jenis dokumen</Label><Input id="archive-kind" value={fields.jenisDokumen} onChange={(e) => update("jenisDokumen", e.target.value)} placeholder="Contoh: Surat Edaran" maxLength={100} required disabled={saving} /></div>
            <div className="space-y-2"><Label htmlFor="archive-date">Tanggal dokumen</Label><Input id="archive-date" type="date" value={fields.tglDokumen} onChange={(e) => { setDateEdited(true); update("tglDokumen", e.target.value); }} required disabled={saving} /></div>
          </div>
          {!editing && <div className="space-y-2"><Label htmlFor="archive-pdf">Softfile PDF</Label><div className="flex flex-col gap-2 sm:flex-row"><Input id="archive-pdf" type="file" accept="application/pdf,.pdf" onChange={(e) => chooseFile(e.target.files?.[0] ?? null)} disabled={saving || reading} required className="max-w-xl file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-emerald-800" /><Button type="button" variant="outline" onClick={readWithGemini} disabled={!file || reading || saving}>{reading ? <><LoaderCircle className="animate-spin" />Membaca...</> : <><Sparkles />Baca dengan Gemini</>}</Button></div><p className="text-xs text-zinc-500">Gemini membaca nama, nomor, jenis, dan tanggal dokumen jika tercantum. Jika gagal menemukan tanggal atau gagal membaca, isian dapat dilengkapi manual. Tinjau hasilnya sebelum menyimpan.</p></div>}
          {warnings.length > 0 && <div role="status" className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{warnings.map((warning, i) => <p key={i}>{warning}</p>)}</div>}
          <div className="flex flex-wrap justify-end gap-2">{editing && <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving}>Batal edit</Button>}<Button type="submit" disabled={saving || reading}>{saving ? <><LoaderCircle className="animate-spin" />Menyimpan...</> : editing ? <><Pencil />Simpan perubahan</> : <><Upload />Simpan arsip</>}</Button></div>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="border-b"><CardTitle>Daftar arsip ({documents.length})</CardTitle><CardDescription>Semua arsip hanya tersedia bagi pengguna yang sudah masuk.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-md"><Search className="absolute left-3 top-2.5 size-4 text-zinc-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, nomor, jenis, atau tanggal..." className="pl-9" /></div>
        {filtered.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500"><FileText className="mx-auto mb-2 size-7" />{documents.length === 0 ? "Belum ada arsip dinas." : "Tidak ada arsip yang cocok dengan pencarian."}</div> :
          <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-4 py-3">Nama dokumen</th><th className="px-4 py-3">Nomor</th><th className="px-4 py-3">Jenis</th><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Softfile</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y">{filtered.map((doc) => <tr key={doc.id} className="align-top"><td className="max-w-xs px-4 py-3 font-medium text-zinc-950">{doc.namaDokumen}</td><td className="px-4 py-3 text-zinc-600">{doc.nomor || "—"}</td><td className="px-4 py-3 text-zinc-600">{doc.jenisDokumen}</td><td className="whitespace-nowrap px-4 py-3 text-zinc-600">{dateLabel(doc.tglDokumen)}</td><td className="whitespace-nowrap px-4 py-3 text-zinc-600">PDF · {sizeLabel(doc.fileSize)}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" render={<a href={`/api/arsip-dinas/${doc.id}/download`} />} aria-label={`Unduh ${doc.namaDokumen}`}><Download className="size-4" /></Button><Button type="button" size="icon" variant="ghost" aria-label={`Edit ${doc.namaDokumen}`} onClick={() => startEdit(doc)}><Pencil className="size-4" /></Button></div></td></tr>)}</tbody></table></div>}
      </CardContent>
    </Card>
  </div>;
}
