"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileText, LoaderCircle, Pencil, Search, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { ArchiveDocument } from "@/lib/arsip-dinas";
import { MAX_ARCHIVE_UPLOAD_SIZE_BYTES, MAX_ARCHIVE_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

type MetadataFields = { namaDokumen: string; nomor: string; jenisDokumen: string; tglDokumen: string };
const empty = (): MetadataFields => ({ namaDokumen: "", nomor: "", jenisDokumen: "", tglDokumen: "" });
function dateLabel(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)); }
function sizeLabel(size: number) { return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`; }

export function ArsipDinas({ initialDocuments }: { initialDocuments: ArchiveDocument[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [fields, setFields] = useState<MetadataFields>(empty);
  const dateEdited = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<{ file: File; uploadId: string; expiresAt: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArchiveDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const filtered = useMemo(() => { const q = query.trim().toLocaleLowerCase("id-ID"); return documents.filter((d) => !q || [d.namaDokumen, d.nomor, d.jenisDokumen, d.tglDokumen].some((v) => v.toLocaleLowerCase("id-ID").includes(q))); }, [documents, query]);

  function update<K extends keyof MetadataFields>(key: K, value: MetadataFields[K]) { setFields((current) => ({ ...current, [key]: value })); }
  function chooseFile(next: File | null) {
    setFile(null); setUploaded(null);
    setWarnings([]);
    if (!dateEdited.current) setFields(current => ({ ...current, tglDokumen: "" }));
    if (next && (next.type !== "application/pdf" || !next.name.toLowerCase().endsWith(".pdf") || !next.size)) { toast.error("Pilih berkas PDF yang tidak kosong."); return false; }
    if (next && next.size > MAX_ARCHIVE_UPLOAD_SIZE_BYTES) { toast.error(`Ukuran PDF maksimal ${MAX_ARCHIVE_UPLOAD_SIZE_MB} MB.`); return false; }
    setFile(next);
    return true;
  }

  async function ensureUploaded(selected: File) {
    if (uploaded?.file === selected && Date.parse(uploaded.expiresAt) > Date.now() + 30_000) return uploaded.uploadId;
    const prepared = await fetch("/api/arsip-dinas/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: selected.name, fileSize: selected.size, contentType: selected.type }) });
    const payload = await prepared.json();
    if (!prepared.ok) throw new Error(payload.message ?? "Unggahan belum dapat disiapkan.");
    if (payload.local) return null;
    const response = await fetch(payload.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf", "x-upsert": "false", "Cache-Control": "max-age=0" }, body: selected });
    if (!response.ok) throw new Error("PDF gagal diunggah. Periksa koneksi lalu coba kembali.");
    setUploaded({ file: selected, uploadId: payload.uploadId, expiresAt: payload.expiresAt });
    return payload.uploadId as string;
  }

  async function readWithGemini() {
    if (!file) { toast.error("Pilih PDF yang akan dibaca terlebih dahulu."); return; }
    setReading(true); setWarnings([]);
    try {
      const uploadId = await ensureUploaded(file);
      let response: Response;
      if (uploadId) response = await fetch("/api/document-ai/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "official-archive", uploadId }) });
      else {
        const form = new FormData(); form.set("kind", "official-archive"); form.set("employeeName", ""); form.set("employeeNip", ""); form.set("documentType", "Arsip dinas"); form.set("file", file);
        response = await fetch("/api/document-ai/extract", { method: "POST", body: form });
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Dokumen gagal dibaca.");
      const values = payload.values as MetadataFields;
      setFields((current) => ({ namaDokumen: current.namaDokumen || values.namaDokumen || "", nomor: current.nomor || values.nomor || "", jenisDokumen: current.jenisDokumen || values.jenisDokumen || "", tglDokumen: dateEdited.current ? current.tglDokumen : values.tglDokumen || "" }));
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
      else {
        const uploadId = await ensureUploaded(file!);
        if (uploadId) response = await fetch("/api/arsip-dinas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, uploadId }) });
        else { const form = new FormData(); Object.entries(fields).forEach(([key, value]) => form.set(key, value)); form.set("file", file!); response = await fetch("/api/arsip-dinas", { method: "POST", body: form }); }
      }
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message ?? "Arsip gagal disimpan.");
      if (editing) setDocuments((current) => current.map((item) => item.id === editing ? payload.document : item));
      else setDocuments((current) => [payload.document, ...current]);
      toast.success(editing ? "Metadata arsip diperbarui." : "Arsip dinas berhasil disimpan.");
      setFields(empty()); dateEdited.current = false; setFile(null); setUploaded(null); setEditing(null); setWarnings([]);
      const input = document.getElementById("archive-pdf") as HTMLInputElement | null; if (input) input.value = "";
    } catch (error) { toast.error(error instanceof Error ? error.message : "Arsip gagal disimpan."); }
    finally { setSaving(false); }
  }

  function startEdit(doc: ArchiveDocument) { setEditing(doc.id); setFields({ namaDokumen: doc.namaDokumen, nomor: doc.nomor, jenisDokumen: doc.jenisDokumen, tglDokumen: doc.tglDokumen }); dateEdited.current = true; setFile(null); setWarnings([]); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function cancelEdit() { setEditing(null); setFields(empty()); dateEdited.current = false; setFile(null); const input = document.getElementById("archive-pdf") as HTMLInputElement | null; if (input) input.value = ""; }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/arsip-dinas/${deleteTarget.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true, updatedAt: deleteTarget.updatedAt }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Arsip gagal dihapus.");
      setDocuments(current => current.filter(item => item.id !== deleteTarget.id));
      if (editing === deleteTarget.id) cancelEdit();
      setDeleteTarget(null);
      if (payload.fileCleanupPending) toast.warning("Arsip dihapus. Pembersihan berkas PDF akan dicoba kembali otomatis.");
      else toast.success("Arsip berhasil dihapus.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Arsip gagal dihapus."); }
    finally { setDeleting(false); }
  }

  return <div className="space-y-6">
    <Card>
      <CardHeader className="border-b"><CardTitle>{editing ? "Edit metadata arsip" : "Tambah arsip dinas"}</CardTitle><CardDescription>PDF maksimal {MAX_ARCHIVE_UPLOAD_SIZE_MB} MB. Nama file unduhan akan mengikuti nama dokumen.</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="archive-name">Nama dokumen</Label><Input id="archive-name" value={fields.namaDokumen} onChange={(e) => update("namaDokumen", e.target.value)} placeholder="Contoh: Surat Edaran Jam Kerja" maxLength={180} required disabled={saving} /></div>
            <div className="space-y-2"><Label htmlFor="archive-number">Nomor dokumen <span className="font-normal text-zinc-500">(jika ada)</span></Label><Input id="archive-number" value={fields.nomor} onChange={(e) => update("nomor", e.target.value)} placeholder="Boleh dikosongkan" maxLength={120} disabled={saving} /></div>
            <div className="space-y-2"><Label htmlFor="archive-kind">Jenis dokumen</Label><Input id="archive-kind" value={fields.jenisDokumen} onChange={(e) => update("jenisDokumen", e.target.value)} placeholder="Contoh: Surat Edaran" maxLength={100} required disabled={saving} /></div>
            <div className="space-y-2"><Label htmlFor="archive-date">Tanggal dokumen</Label><Input id="archive-date" type="date" value={fields.tglDokumen} onChange={(e) => { dateEdited.current = true; update("tglDokumen", e.target.value); }} required disabled={saving} /><p className="text-xs text-zinc-500">Tanggal penetapan/penerbitan surat. Jika belum terbaca, isi manual sesuai dokumen.</p></div>
          </div>
          {!editing && <div className="space-y-2"><Label htmlFor="archive-pdf">Softfile PDF</Label><div className="flex flex-col gap-2 sm:flex-row"><Input id="archive-pdf" type="file" accept="application/pdf,.pdf" onChange={(e) => { if (!chooseFile(e.target.files?.[0] ?? null)) e.target.value = ""; }} disabled={saving || reading} required className="max-w-xl file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-emerald-800" /><Button type="button" variant="outline" onClick={readWithGemini} disabled={!file || reading || saving}>{reading ? <><LoaderCircle className="animate-spin" />Membaca...</> : <><Sparkles />Baca dengan Gemini</>}</Button></div><p className="text-xs text-zinc-500">Gemini membaca nama, nomor, jenis, dan tanggal dokumen jika tercantum dari PDF maksimal {MAX_ARCHIVE_UPLOAD_SIZE_MB} MB. Jika gagal menemukan tanggal atau gagal membaca, isian dapat dilengkapi manual. Tinjau hasilnya sebelum menyimpan.</p></div>}
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
          <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-4 py-3">Nama dokumen</th><th className="px-4 py-3">Nomor</th><th className="px-4 py-3">Jenis</th><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Softfile</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y">{filtered.map((doc) => <tr key={doc.id} className="align-top"><td className="max-w-xs px-4 py-3 font-medium text-zinc-950">{doc.namaDokumen}</td><td className="px-4 py-3 text-zinc-600">{doc.nomor || "—"}</td><td className="px-4 py-3 text-zinc-600">{doc.jenisDokumen}</td><td className="whitespace-nowrap px-4 py-3 text-zinc-600">{dateLabel(doc.tglDokumen)}</td><td className="whitespace-nowrap px-4 py-3 text-zinc-600">PDF · {sizeLabel(doc.fileSize)}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" render={<a href={`/api/arsip-dinas/${doc.id}/download`} />} aria-label={`Unduh ${doc.namaDokumen}`}><Download className="size-4" /></Button><Button type="button" size="icon" variant="ghost" aria-label={`Edit ${doc.namaDokumen}`} disabled={saving || reading || deleting} onClick={() => startEdit(doc)}><Pencil className="size-4" /></Button><Button type="button" size="sm" variant="ghost" className="text-destructive" aria-label={`Hapus ${doc.namaDokumen}`} disabled={saving || reading || deleting} onClick={() => setDeleteTarget(doc)}><Trash2 className="size-4" />Hapus</Button></div></td></tr>)}</tbody></table></div>}
      </CardContent>
    </Card>
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open && !deleting) setDeleteTarget(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus arsip dinas?</AlertDialogTitle><AlertDialogDescription>
        Arsip “{deleteTarget?.namaDokumen}”{deleteTarget?.nomor ? `, nomor ${deleteTarget.nomor}` : ""}{deleteTarget ? `, tanggal ${dateLabel(deleteTarget.tglDokumen)}` : ""} beserta berkas PDF akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
      </AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleting} onClick={confirmDelete}>{deleting ? <><LoaderCircle className="size-4 animate-spin" />Menghapus...</> : "Ya, hapus arsip"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}
