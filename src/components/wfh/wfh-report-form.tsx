"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { wfhReportSchema, type ReportEmployee, type WfhReportTask } from "@/lib/wfh-report-validation";

const initialTasks = (): WfhReportTask[] => [["08:00", "10:00"], ["10:00", "12:00"], ["13:00", "14:00"], ["14:00", "16:00"]].map(([start, end]) => ({ start, end, activity: "", output: "", status: 0 }));
const fieldClass = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-60";

export function WfhReportForm({ employees, today, aiReady }: { employees: ReportEmployee[]; today: string; aiReady: boolean }) {
  const router = useRouter();
  const [nip, setNip] = useState("");
  const [date, setDate] = useState(today);
  const [rank, setRank] = useState("");
  const [tasks, setTasks] = useState(initialTasks);
  const [targets, setTargets] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState<"ai" | "save" | null>(null);
  const [message, setMessage] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [download, setDownload] = useState("");
  const employee = employees.find(e => e.nip === nip);
  function changed() { setReviewed(false); setDownload(""); setMessage(""); setAiMessage(""); }
  function updateTask(i: number, update: Partial<WfhReportTask>) {
    changed(); setTasks(current => current.map((task, n) => n === i ? { ...task, ...update } : task));
  }
  async function suggest() {
    if (!employee) return;
    setBusy("ai"); setAiMessage("");
    try {
      const response = await fetch("/api/wfh-reports/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nip, date }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setTasks(current => current.map((t, i) => ({ ...t, activity: result.tasks[i].activity })));
      setTargets(result.tasks.map((t: { targetOutput: string }) => t.targetOutput));
      setReviewed(false); setDownload("");
      setAiMessage("Usulan tugas sudah siap. Periksa kesesuaiannya, lalu isi realisasi dan status sesuai pekerjaan Anda.");
    } catch (error) { setAiMessage(error instanceof Error ? error.message : "Usulan gagal dibuat."); }
    finally { setBusy(null); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const parsed = wfhReportSchema.safeParse({ nip, date, rank, tasks, reviewed });
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? "Periksa kelengkapan laporan."); return; }
    setBusy("save");
    try {
      const response = await fetch("/api/wfh-reports/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setDownload(result.downloadUrl); setMessage("Laporan berhasil dibuat dan tersimpan di arsip. Gunakan tombol unduh di bawah.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Laporan gagal dibuat."); }
    finally { setBusy(null); }
  }
  return <form onSubmit={submit} className="space-y-5">
    <Card><CardHeader><CardTitle>Profil dan tanggal laporan</CardTitle><CardDescription>Pilih pegawai aktif. Jabatan dan unit kerja mengikuti data pegawai.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="report-employee">Pegawai</Label><select id="report-employee" className={fieldClass} value={nip} disabled={!!busy} onChange={e => { const next = employees.find(p => p.nip === e.target.value); setNip(e.target.value); setRank(next?.rank || ""); setTasks(initialTasks()); setTargets([]); changed(); }} required><option value="">Pilih pegawai</option>{employees.map(e => <option key={e.nip} value={e.nip}>{e.name} — {e.nip}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="report-date">Tanggal WFH</Label><Input id="report-date" type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={e => { setDate(e.target.value); changed(); }} disabled={!!busy} required /></div>
      <div className="space-y-2"><Label htmlFor="report-rank">Pangkat / golongan</Label><Input id="report-rank" value={rank} maxLength={100} onChange={e => { setRank(e.target.value); changed(); }} disabled={!!busy} required placeholder="Lengkapi pangkat / golongan" /></div>
      <div><p className="text-xs text-zinc-500">Jabatan</p><p className="mt-1 text-sm font-medium">{employee?.position || "Pilih pegawai terlebih dahulu"}</p></div>
      <div><p className="text-xs text-zinc-500">Unit kerja</p><p className="mt-1 text-sm font-medium">{employee?.unit || "Pilih pegawai terlebih dahulu"}</p></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Usulan tugas Gemini</CardTitle><CardDescription>Gemini menerima jabatan dan unit kerja untuk membuat empat usulan tugas yang dapat dikerjakan dari rumah. Usulan akan mengganti kolom tugas; realisasi tetap Anda isi sendiri.</CardDescription></CardHeader><CardContent>
      <Button type="button" variant="outline" className="h-auto whitespace-normal py-2 text-left" onClick={suggest} disabled={!!busy || !employee || !aiReady}>{busy === "ai" ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{busy === "ai" ? "Gemini sedang menyusun tugas..." : "Buat usulan tugas dengan Gemini"}</Button>
      {aiMessage && <p role="status" className="mt-3 text-sm leading-6">{aiMessage}</p>}
      {!aiReady && <p className="mt-2 text-sm text-amber-700">Gemini belum dikonfigurasi. Anda tetap dapat mengisi tugas secara manual.</p>}
    </CardContent></Card>
    <div className="space-y-4">{tasks.map((task, i) => <Card key={i}><CardHeader><CardTitle>Kegiatan {i + 1}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor={`start-${i}`}>Mulai</Label><Input id={`start-${i}`} type="time" value={task.start} disabled={!!busy} onChange={e => updateTask(i, { start: e.target.value })} required /></div>
      <div className="space-y-2"><Label htmlFor={`end-${i}`}>Selesai</Label><Input id={`end-${i}`} type="time" value={task.end} disabled={!!busy} onChange={e => updateTask(i, { end: e.target.value })} required /></div>
      <div className="space-y-2"><Label htmlFor={`activity-${i}`}>Rencana aktivitas / tugas</Label><textarea id={`activity-${i}`} className={fieldClass} rows={3} maxLength={300} value={task.activity} disabled={!!busy} onChange={e => updateTask(i, { activity: e.target.value })} required />{targets[i] && <p className="text-xs leading-5 text-indigo-700">Usulan target output: {targets[i]}</p>}</div>
      <div className="space-y-2"><Label htmlFor={`output-${i}`}>Realisasi hasil / output</Label><textarea id={`output-${i}`} className={fieldClass} rows={3} maxLength={240} value={task.output} disabled={!!busy} onChange={e => updateTask(i, { output: e.target.value })} placeholder="Isi hasil yang benar-benar sudah dikerjakan" required /></div>
      <div className="space-y-2"><Label htmlFor={`status-${i}`}>Penyelesaian (%)</Label><Input id={`status-${i}`} type="number" min={0} max={100} step={1} value={task.status} disabled={!!busy} onChange={e => updateTask(i, { status: e.target.value === "" ? 0 : Number(e.target.value) })} required /></div>
    </CardContent></Card>)}</div>
    <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={reviewed} disabled={!!busy} onChange={e => setReviewed(e.target.checked)} className="mt-1 size-4 shrink-0" />Saya telah memeriksa tugas, realisasi, waktu, dan persentase penyelesaian sesuai pekerjaan yang dilakukan.</label>
    {message && <p role="status" className="rounded-lg border bg-white p-3 text-sm leading-6">{message}</p>}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={!!busy || !reviewed || !employee}>{busy === "save" ? <LoaderCircle className="animate-spin" /> : <FileDown />}Buat dan simpan laporan</Button>{download && <a className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white" href={download}><FileDown className="size-4" />Unduh laporan DOCX</a>}</div>
  </form>;
}
