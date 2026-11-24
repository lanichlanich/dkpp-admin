"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Paperclip, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SURAT_TUGAS_SOURCE_MAX_BYTES, suratTugasAiInput, suratTugasAiResult, type SuratTugasAiResult } from "@/lib/surat-tugas-validation";

export function SuratTugasAiPanel({ apply }: { apply: (field: keyof SuratTugasAiResult, items: string[]) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<File>();
  const [dasar, setDasar] = useState("");
  const [tugas, setTugas] = useState("");
  const [preview, setPreview] = useState<SuratTugasAiResult>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  async function suggest() {
    if (busy.current) return;
    setError("");
    setNotice("");
    setPreview(undefined);
    const input = suratTugasAiInput(!!source).safeParse({ dasar: source ? "" : dasar, tugas });
    if (!input.success) { setError(input.error.issues[0].message); return; }
    busy.current = true;
    setPending(true);
    try {
      const form = new FormData();
      if (source) { form.set("source", source); form.set("dasar", input.data.dasar); form.set("tugas", input.data.tugas); }
      const response = await fetch("/api/surat-tugas/suggest", source ? { method: "POST", body: form } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Saran belum tersedia. Anda tetap bisa mengisi manual.");
      const parsed = suratTugasAiResult.safeParse(data);
      if (!parsed.success) throw new Error("Saran tidak sesuai format.");
      setPreview(parsed.data);
      setNotice("Saran tersedia. Periksa sebelum digunakan.");
    } catch (error) { setError(error instanceof Error ? error.message : "Saran belum tersedia."); }
    finally { busy.current = false; setPending(false); }
  }
  return <details className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/30">
    <summary className="cursor-pointer text-sm font-semibold"><Sparkles className="mr-2 inline size-4 text-violet-600" aria-hidden/>Bantu tulis dengan OpenAI</summary>
    <fieldset disabled={pending} className="mt-3 min-w-0 space-y-3" aria-busy={pending}>
      <p className="text-sm text-muted-foreground">Catatan dan lampiran dikirim ke OpenAI hanya saat Anda meminta saran. Jangan unggah surat rahasia atau yang memuat NIP/data pribadi tanpa disamarkan. Lampiran tidak disimpan di arsip Surat Tugas.</p>
      <div className="grid min-w-0 gap-2 rounded-lg border border-violet-200 bg-card p-3 dark:border-violet-900">
        <label className="grid min-w-0 gap-1 text-sm font-medium"><span><Paperclip className="mr-1 inline size-4" aria-hidden/> Unggah surat dasar (opsional)</span>
          <Input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => {
            const file = event.target.files?.[0]; setPreview(undefined); setNotice(""); setError("");
            if (file && (!file.size || file.size > SURAT_TUGAS_SOURCE_MAX_BYTES)) { setSource(undefined); event.target.value = ""; setError("Pilih berkas yang tidak kosong, maksimal 4 MB."); return; }
            setSource(file);
          }}/>
        </label>
        <p className="text-xs text-muted-foreground">Satu PDF, JPG, atau PNG, maksimal 4 MB.</p>
        {source && <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => { if (fileInput.current) fileInput.current.value = ""; setSource(undefined); setPreview(undefined); setNotice(""); setError(""); }}><X aria-hidden/> Lepas lampiran</Button>}
      </div>
      {!source && <label className="grid gap-1 text-sm font-medium">Catatan dasar (opsional)<Textarea maxLength={1600} value={dasar} onChange={e => { setDasar(e.target.value); setPreview(undefined); setNotice(""); }} placeholder="Nomor, tanggal, pengirim, dan perihal surat rujukan yang sudah diketahui"/></label>}
      <label className="grid gap-1 text-sm font-medium">Catatan penugasan{source ? " (opsional)" : ""}<Textarea maxLength={2400} value={tugas} onChange={e => { setTugas(e.target.value); setPreview(undefined); setNotice(""); }} placeholder="Kegiatan, waktu, tempat, dan hasil yang perlu disampaikan"/></label>
      <Button type="button" variant="outline" disabled={pending} onClick={suggest}>{pending ? <LoaderCircle className="animate-spin" aria-hidden/> : <Sparkles aria-hidden/>}{pending ? "Menyusun saran…" : "Buat saran AI"}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      {preview && <div className="grid gap-3 sm:grid-cols-2">{([['dasar', 'Dasar'], ['tugas', 'Penugasan']] as const).map(([field, label]) => <section key={field} className="min-w-0 space-y-2 rounded-lg border bg-card p-3">
        <h3 className="text-sm font-semibold">Saran {label}</h3>
        {preview[field].length ? <><ol className="list-decimal space-y-1 pl-5 text-sm wrap-anywhere">{preview[field].map((text, i) => <li key={i}>{text}</li>)}</ol><Button type="button" size="sm" variant="outline" onClick={() => { apply(field, preview[field]); setNotice(`${label} diganti dengan saran. Anda masih bisa mengeditnya.`); }}>Ganti isi {label}</Button></> : <p className="text-sm text-muted-foreground">{field === "dasar" ? "Tidak ada rujukan yang terbaca. Isi Dasar secara manual." : "Tidak ada rincian penugasan yang terbaca. Tambahkan konteks atau isi secara manual."}</p>}
      </section>)}</div>}
    </fieldset>
  </details>;
}
