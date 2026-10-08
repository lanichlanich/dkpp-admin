"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignatoryField } from "@/components/letters/signatory-field";
import { DEFAULT_SIGNATORY, type Signatory, type SignatoryOption } from "@/lib/signatory";
import { formatKakRupiah, type KakDraft, type KakHistory } from "@/lib/kak-types";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

type Result = { id: string; fileName: string; metadata: KakDraft["metadata"]; warnings: string[] };
export function KakForm({ history, today, signatories }: { history: KakHistory[]; today: string; signatories: SignatoryOption[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [date, setDate] = useState(today);
  const [pptkNama, setPptkNama] = useState("");
  const [pptkNip, setPptkNip] = useState("");
  const [override, setOverride] = useState(false);
  const [signatory, setSignatory] = useState<Signatory>(signatories[0] || DEFAULT_SIGNATORY);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !/\.pdf$/i.test(file.name) || file.size === 0) { setError("Pilih satu RKA PDF yang valid."); return; }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) { setError(`Ukuran RKA maksimal ${MAX_UPLOAD_SIZE_MB} MB.`); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      const body = new FormData(); body.set("file", file);
      body.set("options", JSON.stringify({ tanggalDokumen: date, pptkNama, pptkNip, ...(override ? { signatory } : {}) }));
      const response = await fetch("/api/kak/generate", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Draft KAK gagal dibuat.");
      const saved = data as Result;
      setResult(saved); router.refresh();
      const download = await fetch(`/api/kak/${saved.id}/download`);
      if (!download.ok) throw new Error("Draft tersimpan, tetapi unduh otomatis gagal. Gunakan tombol Unduh DOCX di bawah.");
      const url = URL.createObjectURL(await download.blob());
      const link = document.createElement("a"); link.href = url; link.download = saved.fileName;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success("Draft KAK dibuat dan disimpan.");
    } catch (err) { const message = err instanceof Error ? err.message : "Pembuatan KAK gagal."; setError(message); toast.error(message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <form onSubmit={submit} className="space-y-4">
      <Card><CardHeader><CardTitle>Unggah RKA, unduh draft KAK</CardTitle><CardDescription>Gemini membaca RKA dan mengisi 19 bagian pada template KAK. RKA sumber dan draft Word disimpan dalam arsip.</CardDescription></CardHeader>
        <CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="kak-rka">RKA rincian satu sub kegiatan (PDF)</Label><Input id="kak-rka" ref={fileRef} type="file" accept=".pdf,application/pdf" required disabled={busy} /><p className="text-xs text-zinc-500">Maksimal {MAX_UPLOAD_SIZE_MB} MB. Gunakan PDF yang jelas dan memuat tahun anggaran serta pagu.</p></div>
          <div className="space-y-2"><Label htmlFor="kak-date">Tanggal KAK</Label><Input id="kak-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} className="max-w-xs" /></div>
          <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Identitas tambahan (opsional)</summary><div className="mt-4 space-y-4"><p className="text-sm text-zinc-500">Penandatangan mengikuti RKA. PPTK yang belum diisi diberi penanda untuk dilengkapi pada draft.</p><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="kak-pptk">Nama PPTK</Label><Input id="kak-pptk" value={pptkNama} onChange={(e) => setPptkNama(e.target.value)} maxLength={160} disabled={busy} /></div><div className="space-y-2"><Label htmlFor="kak-pptk-nip">NIP PPTK</Label><Input id="kak-pptk-nip" value={pptkNip} onChange={(e) => setPptkNip(e.target.value.replace(/\D/g, ""))} maxLength={18} disabled={busy} /></div></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} disabled={busy} />Ganti penandatangan dari RKA</label>{override && <SignatoryField value={signatory} onChange={setSignatory} options={signatories} disabled={busy} />}</div></details>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{busy ? "Gemini sedang menyusun KAK..." : "Generate dan unduh draft KAK"}</Button>
          {busy && <p role="status" className="text-sm text-zinc-500">Pembacaan RKA dan pengisian template dapat memerlukan hingga beberapa menit.</p>}
        </CardContent></Card>
    </form>
    {result && <Card><CardHeader><CardTitle>Draft KAK siap</CardTitle><CardDescription>{result.metadata.subKegiatan} · TA {result.metadata.tahunAnggaran} · {formatKakRupiah(result.metadata.paguAnggaran)}</CardDescription></CardHeader><CardContent className="space-y-4"><a href={`/api/kak/${result.id}/download`} className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 underline"><Download className="size-4" />Unduh DOCX</a><ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></CardContent></Card>}
    <Card><CardHeader><CardTitle>Arsip draft KAK</CardTitle><CardDescription>Unduh kembali draft dan RKA sumber. Periksa narasi serta identitas sebelum KAK ditetapkan.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-zinc-500"><th className="p-3">Sub kegiatan</th><th className="p-3">TA / Pagu</th><th className="p-3">Dibuat</th><th className="p-3">Unduh</th></tr></thead><tbody>{history.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-zinc-500">Belum ada draft KAK.</td></tr>}{history.map((h) => <tr key={h.id} className="border-b align-top"><td className="min-w-64 p-3"><p className="font-medium">{h.subKegiatan}</p><p className="text-xs text-zinc-500">{h.kodeSubKegiatan}</p>{h.warnings.length > 0 && <details className="mt-2 text-xs text-amber-800"><summary className="cursor-pointer">Catatan pemeriksaan</summary><ul className="mt-2 list-disc space-y-1 pl-4">{h.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}</td><td className="whitespace-nowrap p-3">{h.tahunAnggaran}<p>{formatKakRupiah(h.paguAnggaran)}</p></td><td className="whitespace-nowrap p-3">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(h.createdAt))}<p className="text-xs text-zinc-500">{h.createdBy}</p></td><td className="space-y-2 whitespace-nowrap p-3"><a className="block font-medium text-emerald-700 underline" href={`/api/kak/${h.id}/download`}>Draft DOCX</a><a className="block text-emerald-700 underline" href={`/api/kak/${h.id}/download?source=rka`}>RKA PDF</a></td></tr>)}</tbody></table></div></CardContent></Card>
  </div>;
}
