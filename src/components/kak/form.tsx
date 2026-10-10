"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Download, LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SignatoryField } from "@/components/letters/signatory-field";
import { DEFAULT_SIGNATORY, type Signatory, type SignatoryOption } from "@/lib/signatory";
import { formatKakRupiah, type KakDraft, type KakHistory, type KakReference } from "@/lib/kak-types";
import type { PptkEmployeeOption } from "@/lib/employees";
import { cn } from "@/lib/utils";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

type Result = { id: string; fileName: string; poFileName: string; bundleFileName: string; metadata: KakDraft["metadata"]; warnings: string[]; references: KakReference[]; nomorUrutSubKegiatan: string; nomorUrutReference?: KakReference };
function DownloadLinks({ id, hasPo }: { id: string; hasPo: boolean }) {
  const linkClass = "inline-flex items-center gap-2 font-medium text-emerald-700 underline";
  return <div className="flex flex-col items-start gap-2">{hasPo && <><a href={`/api/kak/${id}/download?format=zip`} className={linkClass}><Download className="size-4" />PO dan KAK (ZIP)</a><a href={`/api/kak/${id}/download?source=po`} className={linkClass}>PO (DOCX)</a></>}<a href={`/api/kak/${id}/download`} className={linkClass}>KAK (DOCX)</a><a href={`/api/kak/${id}/download?source=rka`} className={linkClass}>RKA sumber (PDF)</a></div>;
}
function ReferenceList({ references }: { references: KakReference[] }) {
  if (!references.length) return null;
  return <details className="text-sm text-emerald-800"><summary className="cursor-pointer font-medium">Sumber referensi yang digunakan</summary><ul className="mt-2 space-y-2">{references.map((r) => <li key={r.id}><p className="font-medium">{r.title}</p><p className="mt-1 text-xs text-zinc-500">{r.locators.join("; ")}</p></li>)}</ul></details>;
}
function findDefaultPptk(employees: PptkEmployeeOption[]) {
  return employees.find((employee) => employee.name.toLocaleUpperCase("id-ID").replace(/[^A-Z]/g, "").replace("MUHAMMAD", "MUHAMAD").startsWith("MUHAMADIQBAL"));
}

export function KakForm({ history, today, signatories, employees }: { history: KakHistory[]; today: string; signatories: SignatoryOption[]; employees: PptkEmployeeOption[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const defaultPptk = findDefaultPptk(employees);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [date, setDate] = useState(today);
  const [sequence, setSequence] = useState("");
  const [procurement, setProcurement] = useState<"" | "Penyedia" | "Swakelola" | "Kombinasi">("");
  const [pptkNip, setPptkNip] = useState(defaultPptk?.nip || "");
  const [pptkOpen, setPptkOpen] = useState(false);
  const selectedPptk = employees.find((employee) => employee.nip === pptkNip);
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
      body.set("options", JSON.stringify({ tanggalDokumen: date, nomorUrutSubKegiatan: sequence, poSistemPengadaan: procurement, pptkNama: selectedPptk?.name || "", pptkNip: selectedPptk?.nip || "", ...(override ? { signatory } : {}) }));
      const response = await fetch("/api/kak/generate", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Draft PO dan KAK gagal dibuat.");
      const saved = data as Result;
      setResult(saved); router.refresh();
      const download = await fetch(`/api/kak/${saved.id}/download?format=zip`);
      if (!download.ok) throw new Error("PO dan KAK tersimpan, tetapi unduh otomatis gagal. Gunakan tombol unduh di bawah.");
      const url = URL.createObjectURL(await download.blob());
      const link = document.createElement("a"); link.href = url; link.download = saved.bundleFileName;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success("Draft PO dan KAK dibuat, disimpan, dan diunduh.");
    } catch (err) { const message = err instanceof Error ? err.message : "Pembuatan PO dan KAK gagal."; setError(message); toast.error(message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <form onSubmit={submit} className="space-y-4">
      <Card><CardHeader><CardTitle>Satu RKA, dua dokumen: PO dan KAK</CardTitle><CardDescription>Gemini membaca RKA dan menggunakan referensi Renstra/Renja DKPP untuk menyusun Petunjuk Operasional dan Kerangka Acuan Kerja. Dua dokumen Word diunduh dalam satu ZIP dan tersimpan bersama RKA sumber.</CardDescription></CardHeader>
        <CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="kak-rka">RKA rincian satu sub kegiatan (PDF)</Label><Input id="kak-rka" ref={fileRef} type="file" accept=".pdf,application/pdf" required disabled={busy} /><p className="text-xs text-zinc-500">Maksimal {MAX_UPLOAD_SIZE_MB} MB. Gunakan PDF yang jelas dan memuat tahun anggaran serta pagu.</p></div>
          <div className="space-y-2"><Label htmlFor="kak-date">Tanggal PO dan KAK</Label><Input id="kak-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} className="max-w-xs" /></div>
          <div className="space-y-2"><Label htmlFor="po-procurement">Sistem pengadaan barang/jasa pada PO</Label><select id="po-procurement" value={procurement} onChange={(e) => setProcurement(e.target.value as typeof procurement)} disabled={busy} className="h-10 w-full max-w-sm rounded-lg border bg-background px-3 text-sm"><option value="">Mengikuti RKA jika tercantum</option><option value="Penyedia">Penyedia</option><option value="Swakelola">Swakelola</option><option value="Kombinasi">Kombinasi</option></select><p className="text-xs text-zinc-500">Pilih sesuai penetapan kegiatan jika RKA tidak menyebutkannya. Pilihan ini juga menjadi acuan usulan metode KAK. Jika belum dipilih, PO diberi penanda untuk dilengkapi.</p></div>
          <div className="space-y-2"><Label htmlFor="kak-sequence">Nomor urut sub kegiatan pada cover PO dan KAK</Label><Input id="kak-sequence" value={sequence} onChange={(e) => setSequence(e.target.value)} maxLength={32} placeholder="Otomatis dari RKA TA 2027" disabled={busy} className="max-w-sm" /><p className="text-xs text-zinc-500">Biarkan kosong untuk mengikuti daftar sub kegiatan DKPP 2027. Nomor yang sama tampil di kanan atas kedua cover setelah RKA dibaca. Isi manual jika perlu mengganti nomor atau memakai tahun anggaran lain.</p></div>
          <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-medium">Referensi otomatis DKPP</p><p className="mt-1">Renstra 2025–2029 dan Rancangan Akhir Renja 2027 digunakan sesuai tahun KAK. Anda cukup mengunggah RKA.</p><p className="mt-2 text-xs">Pagu dan target keluaran tetap mengikuti RKA. Perbedaan dengan rencana indikatif akan ditampilkan sebagai catatan.</p></div>
          <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Identitas tambahan</summary><div className="mt-4 space-y-4"><p className="text-sm text-zinc-500">PPTK dipilih dari pegawai aktif. Bawaan: Muhamad Iqbal. Nama dan NIP mengikuti data pegawai terpilih.</p><div className="space-y-2"><Label htmlFor="kak-pptk">Nama PPTK</Label><Popover open={pptkOpen} onOpenChange={setPptkOpen}><PopoverTrigger render={<Button id="kak-pptk" type="button" variant="outline" role="combobox" aria-expanded={pptkOpen} disabled={busy || employees.length === 0} className="h-11 w-full justify-between overflow-hidden px-3 font-normal" />}><span className={cn("min-w-0 truncate text-left", !selectedPptk && "text-muted-foreground")}>{selectedPptk ? `${selectedPptk.name} · ${selectedPptk.nip}` : employees.length ? "Pilih PPTK" : "Daftar pegawai aktif kosong"}</span><ChevronsUpDown className="size-4 shrink-0 opacity-50" /></PopoverTrigger><PopoverContent align="start" className="w-[var(--anchor-width)] p-0"><Command><CommandInput placeholder="Cari nama, NIP, atau jabatan..." /><CommandList><CommandEmpty>Pegawai tidak ditemukan.</CommandEmpty><CommandGroup>{employees.map((employee) => <CommandItem key={employee.nip} value={`${employee.name} ${employee.nip} ${employee.position} ${employee.unit}`} onSelect={() => { setPptkNip(employee.nip); setPptkOpen(false); }}><Check className={cn("size-4 shrink-0", pptkNip === employee.nip ? "opacity-100" : "opacity-0")} /><span className="min-w-0"><span className="block truncate">{employee.name}</span><span className="block truncate text-xs text-muted-foreground">{employee.nip} · {employee.position}</span></span></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} disabled={busy} />Ganti penandatangan dari RKA</label>{override && <SignatoryField value={signatory} onChange={setSignatory} options={signatories} disabled={busy} />}</div></details>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{busy ? "Gemini sedang menyusun PO dan KAK..." : "Generate dan unduh PO dan KAK"}</Button>
          {busy && <p role="status" className="text-sm text-zinc-500">Pembacaan RKA dan pengisian template dapat memerlukan hingga beberapa menit.</p>}
        </CardContent></Card>
    </form>
    {result && <Card><CardHeader><CardTitle>Draft PO dan KAK siap</CardTitle><CardDescription>{result.metadata.subKegiatan} · TA {result.metadata.tahunAnggaran} · {formatKakRupiah(result.metadata.paguAnggaran)}</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-sm">Nomor urut cover: <span className="font-semibold">{result.nomorUrutSubKegiatan || "Belum diisi"}</span>{result.nomorUrutSubKegiatan && <span className="text-zinc-500"> · {result.nomorUrutReference ? "Daftar DKPP 2027" : "Diisi manual"}</span>}</p><DownloadLinks id={result.id} hasPo={Boolean(result.poFileName)} /><ReferenceList references={[...(result.references || []), ...(result.nomorUrutReference ? [result.nomorUrutReference] : [])]} /><ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></CardContent></Card>}
    <Card><CardHeader><CardTitle>Arsip PO dan KAK</CardTitle><CardDescription>Unduh kembali PO, KAK, dan RKA sumber. Periksa isian sebelum dokumen ditetapkan.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-zinc-500"><th className="p-3">Sub kegiatan</th><th className="p-3">TA / Pagu</th><th className="p-3">Dibuat</th><th className="p-3">Unduh</th></tr></thead><tbody>{history.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-zinc-500">Belum ada arsip PO dan KAK.</td></tr>}{history.map((h) => <tr key={h.id} className="border-b align-top"><td className="min-w-64 p-3"><p className="font-medium">{h.subKegiatan}</p><p className="text-xs text-zinc-500">{h.kodeSubKegiatan}</p>{h.nomorUrutSubKegiatan && <p className="mt-1 text-xs text-zinc-500">Nomor urut cover: {h.nomorUrutSubKegiatan}</p>}<ReferenceList references={[...(h.references || []), ...(h.nomorUrutReference ? [h.nomorUrutReference] : [])]} />{h.warnings.length > 0 && <details className="mt-2 text-xs text-amber-800"><summary className="cursor-pointer">Catatan pemeriksaan</summary><ul className="mt-2 list-disc space-y-1 pl-4">{h.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}</td><td className="whitespace-nowrap p-3">{h.tahunAnggaran}<p>{formatKakRupiah(h.paguAnggaran)}</p></td><td className="whitespace-nowrap p-3">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(h.createdAt))}<p className="text-xs text-zinc-500">{h.createdBy}</p></td><td className="space-y-2 whitespace-nowrap p-3"><DownloadLinks id={h.id} hasPo={Boolean(h.poFileName)} />{!h.poFileName && <p className="text-xs text-zinc-500">Arsip KAK lama; PO belum tersedia.</p>}</td></tr>)}</tbody></table></div></CardContent></Card>
  </div>;
}
