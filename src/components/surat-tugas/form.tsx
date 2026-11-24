"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, BadgeCheck, ClipboardList, Download, FileText, LoaderCircle, Plus, Search, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SuratTugasAiPanel } from "./ai-panel";
import { suratTugasSchema, TUGAS_SIGNER, type TugasEmployee } from "@/lib/surat-tugas-validation";

type Entry = { id: number; text: string };
function Lines({ label, entries, change, max, limit, hint }: { label: string; entries: Entry[]; change: (entries: Entry[]) => void; max: number; limit: number; hint: string }) {
  const listId = useId();
  const next = useRef(1);
  return <fieldset className="min-w-0 space-y-2"><legend className="text-sm font-semibold">{label}</legend><p id={`${listId}-hint`} className="text-xs text-muted-foreground">{hint}</p>
    {entries.map(({ id, text }, index) => <div key={id} className="flex items-start gap-2">
      <span className="mt-2 text-xs text-muted-foreground" aria-hidden>{index + 1}.</span>
      <Textarea aria-label={`${label} ${index + 1}`} aria-describedby={`${listId}-hint`} rows={2} maxLength={max} required value={text} onChange={e => change(entries.map(entry => entry.id === id ? { id, text: e.target.value.replace(/[\r\n\t]+/g, " ") } : entry))}/>
      {entries.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Hapus ${label.toLowerCase()} ${index + 1}`} onClick={() => change(entries.filter(entry => entry.id !== id))}><X aria-hidden/></Button>}
    </div>)}
    <Button type="button" variant="outline" disabled={entries.length >= limit} onClick={() => change([...entries, { id: (next.current = Math.max(next.current, ...entries.map(entry => entry.id)) + 1), text: "" }])}><Plus aria-hidden/> Tambah butir</Button>
  </fieldset>;
}

export function SuratTugasForm({ employees, today }: { employees: TugasEmployee[]; today: string }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TugasEmployee[]>([]);
  const [dasar, setDasar] = useState<Entry[]>([{ id: 0, text: "" }]);
  const [tugas, setTugas] = useState<Entry[]>([{ id: 0, text: "" }]);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string }>();
  const key = query.trim().toLowerCase();
  const hits = key ? employees.filter(person => !selected.some(item => item.nip === person.nip) && `${person.name} ${person.nip}`.toLowerCase().includes(key)) : [];
  function move(index: number, direction: number) {
    const next = [...selected];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setSelected(next);
  }
  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    setResult(undefined);
    const data = new FormData(event.currentTarget);
    const parsed = suratTugasSchema.safeParse({ nomor: data.get("nomor"), tanggal: data.get("tanggal"), tempat: data.get("tempat"), dasar: dasar.map(x => x.text), tugas: tugas.map(x => x.text), employeeNips: selected.map(x => x.nip), confirmSigner: data.get("signer") === "on" });
    if (!parsed.success) { setResult({ ok: false, message: parsed.error.issues[0].message }); return; }
    busy.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/surat-tugas/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      if (!response.ok) { const error = await response.json().catch(() => null); throw new Error(error?.message ?? "Surat belum dapat diunduh."); }
      const file = await response.blob();
      if (!file.type.includes("wordprocessingml.document")) throw new Error("Respons bukan dokumen Word. Muat ulang halaman.");
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Surat-Tugas-${parsed.data.tanggal}.docx`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setResult({ ok: true, message: "Unduhan Word dimulai. TTE belum dibubuhkan." });
    } catch (error) { setResult({ ok: false, message: error instanceof Error ? error.message : "Surat belum dapat diunduh." }); }
    finally { busy.current = false; setPending(false); }
  }
  return <form onSubmit={download} aria-busy={pending}>
    <fieldset disabled={pending} className="grid min-w-0 gap-4">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-4 text-indigo-600" aria-hidden/> Identitas surat</CardTitle><CardDescription>Masukkan nomor resmi dari pencatatan surat. Nomor tidak dibuat otomatis.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-sm [&_label]:font-medium">
          <label>Nomor surat<Input name="nomor" required maxLength={100}/></label><label>Tanggal surat<Input name="tanggal" type="date" defaultValue={today} required/></label><label>Tempat penetapan<Input name="tempat" defaultValue="Indramayu" required maxLength={80}/></label>
        </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="size-4 text-emerald-600" aria-hidden/> Pegawai yang ditugaskan</CardTitle><CardDescription>Pilih hingga 20 pegawai aktif. Urutan di bawah sama dengan urutan di Word.</CardDescription></CardHeader><CardContent className="space-y-3">
        <label className="grid gap-1.5 text-sm font-medium">Cari nama atau NIP<span className="relative"><Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" aria-hidden/><Input className="pl-8" type="search" value={query} maxLength={160} onChange={e => setQuery(e.target.value)}/></span></label>
        {key && <div className="max-h-56 space-y-1 overflow-auto rounded-lg border p-2">{hits.length ? hits.slice(0, 12).map(person => <Button key={person.nip} type="button" variant="ghost" className="h-auto w-full justify-start py-2 text-left whitespace-normal" disabled={selected.length >= 20} onClick={() => { setSelected([...selected, person]); setQuery(""); }}><Plus aria-hidden/><span>{person.name}<span className="block text-xs text-muted-foreground">{person.nip} · {person.position}</span></span></Button>) : <p className="p-2 text-sm text-muted-foreground">Tidak ada pegawai aktif yang cocok.</p>}</div>}
        {!selected.length ? <p className="text-sm text-muted-foreground">Belum ada pegawai dipilih.</p> : <ol className="divide-y rounded-lg border">{selected.map((person, i) => <li key={person.nip} className="flex flex-wrap items-center justify-between gap-2 p-2.5"><div className="min-w-0"><p className="break-words text-sm font-semibold">{i+1}. {person.name}</p><p className="break-words text-xs text-muted-foreground">{person.nip} · {person.position}</p></div><div className="flex gap-1"><Button type="button" size="icon" variant="ghost" aria-label={`Naikkan ${person.name}`} disabled={!i} onClick={() => move(i,-1)}><ArrowUp aria-hidden/></Button><Button type="button" size="icon" variant="ghost" aria-label={`Turunkan ${person.name}`} disabled={i === selected.length-1} onClick={() => move(i,1)}><ArrowDown aria-hidden/></Button><Button type="button" size="icon" variant="destructive" aria-label={`Hapus ${person.name}`} onClick={() => setSelected(selected.filter(x => x.nip !== person.nip))}><X aria-hidden/></Button></div></li>)}</ol>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="size-4 text-sky-600" aria-hidden/> Dasar dan rincian tugas</CardTitle></CardHeader><CardContent className="space-y-4"><SuratTugasAiPanel apply={(field, items) => (field === "dasar" ? setDasar : setTugas)(items.map((text, id) => ({ id, text })))}/><Lines label="Dasar" entries={dasar} change={setDasar} max={400} limit={8} hint="Cantumkan landasan tugas, misalnya nomor dan tanggal surat undangan."/><Lines label="Untuk" entries={tugas} change={setTugas} max={600} limit={10} hint="Cantumkan kegiatan yang ditugaskan, waktu, tempat, atau kewajiban pelaporan bila relevan."/></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><BadgeCheck className="size-4 text-amber-600" aria-hidden/> Penandatangan dan unduhan</CardTitle><CardDescription>Word memakai kop DKPP dan penanda TTE. Dokumen tidak ditandatangani, dikirim, atau diarsipkan otomatis.</CardDescription></CardHeader><CardContent className="space-y-3">
        <p className="text-sm font-semibold">{TUGAS_SIGNER} <span className="font-normal text-muted-foreground">· Plt. Kepala Dinas</span></p>
        <label className="flex items-start gap-2 text-sm"><input className="mt-1 size-4 shrink-0 accent-primary" type="checkbox" name="signer" required/> Saya telah memastikan pejabat ini berwenang menandatangani pada tanggal surat.</label>
        <Button type="submit" size="lg" disabled={pending || !selected.length}>{pending ? <LoaderCircle className="animate-spin" aria-hidden/> : <Download aria-hidden/>}{pending ? "Menyiapkan Word…" : "Buat dan unduh Word"}</Button>
        {result && <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-emerald-800 dark:text-emerald-300" : "text-destructive"}`}>{result.message}</p>}
      </CardContent></Card>
    </fieldset>
  </form>;
}
