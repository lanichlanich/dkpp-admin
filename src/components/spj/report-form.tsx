"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SPJ_HOLIDAY_SOURCES, spjCalendar, spjMonthDays, spjPeriodLabel, type SpjDay } from "@/lib/spj-calendar";
import type { SpjOptions } from "@/lib/spj-types";
import { SpjDownloads, SpjEmployeePicker, spjActionClass, spjMoney, spjRequest, spjSelectClass } from "./shared";

export function SpjReportForm({ options, today, initialSeed }: { options: SpjOptions; today: string; initialSeed: string }) {
  const router = useRouter();
  const [typeId, setTypeId] = useState(""), [period, setPeriod] = useState(today.slice(0, 7));
  const [documentDate, setDocumentDate] = useState(`${period}-${spjMonthDays(period)}`);
  const [seed, setSeed] = useState(initialSeed), [requestId, setRequestId] = useState(initialSeed);
  const [signers, setSigners] = useState(options.defaults), [busy, setBusy] = useState(false), [error, setError] = useState(""), [savedId, setSavedId] = useState("");
  const type = options.types.find(t => t.id === typeId), workers = options.workers.filter(w => w.typeId === typeId && w.isActive);
  let days: SpjDay[] = [], calendarError = "";
  if (type) { try { days = spjCalendar(period, type, seed); } catch (e) { calendarError = (e as Error).message; } }
  const active = days.filter(d => d.state === "active").length, total = active * (type?.dailyRate ?? 0) * workers.length;
  const changed = () => { setSavedId(""); setError(""); setRequestId(crypto.randomUUID()); };
  const selectSigner = (key: keyof typeof signers, value: string) => { setSigners(v => ({ ...v, [key]: value })); changed(); };
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!type) return;
    setBusy(true); setError("");
    try {
      const result = await spjRequest("reports", "POST", { requestId, typeId, typeUpdatedAt: type.updatedAt, period, documentDate, seed,
        workers: workers.map(w => ({ id: w.id, updatedAt: w.updatedAt })), ...signers });
      setSavedId(result.id); toast.success("SPJ disimpan. Kedua PDF siap diunduh."); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-6"><Card><CardHeader><CardTitle>Periode dan jenis tenaga</CardTitle></CardHeader><CardContent className="space-y-5">
    <fieldset disabled={busy} className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label htmlFor="spj-type">Jenis daftar hadir</Label><select required id="spj-type" className={spjSelectClass} value={typeId} onChange={e => { setTypeId(e.target.value); setSeed(crypto.randomUUID()); changed(); }}><option value="">Pilih jenis tenaga</option>{options.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="spj-period">Bulan SPJ</Label><Input required id="spj-period" type="month" min="2026-01" max="2027-12" value={period} onChange={e => { const next = e.target.value; setPeriod(next); if (/^\d{4}-(0[1-9]|1[0-2])$/.test(next)) setDocumentDate(`${next}-${spjMonthDays(next)}`); setSeed(crypto.randomUUID()); changed(); }} /></div>
      <div className="space-y-2"><Label htmlFor="spj-document-date">Tanggal dokumen</Label><Input required id="spj-document-date" type="date" value={documentDate} onChange={e => { setDocumentDate(e.target.value); changed(); }} /></div></fieldset>
    {type && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 text-sm"><p><strong>{active} hari aktif</strong> · {workers.length} petugas · {spjMoney(type.dailyRate)}/hari · Total <strong>{spjMoney(total)}</strong></p><Button type="button" size="sm" variant="outline" className={spjActionClass.edit} disabled={busy || !!calendarError} onClick={() => { setSeed(crypto.randomUUID()); changed(); }}><Shuffle className="size-4" />Acak ulang hari aktif</Button></div>}
    {calendarError && <p role="alert" className="text-sm text-rose-700">{calendarError}</p>}
    {type && !workers.length && <p role="alert" className="text-sm text-amber-800">Belum ada petugas aktif. Tambahkan melalui tab Petugas.</p>}
    <p className="text-xs text-zinc-500">Kalender libur nasional tersedia untuk <a className="underline" href={SPJ_HOLIDAY_SOURCES["2026"]} target="_blank" rel="noreferrer">2026</a> dan <a className="underline" href={SPJ_HOLIDAY_SOURCES["2027"]} target="_blank" rel="noreferrer">2027</a> sesuai SKB. Cuti bersama tidak dihitung sebagai libur nasional.</p>
  </CardContent></Card>
  {days.length > 0 && <Card><CardHeader><CardTitle>Pratinjau jadwal {spjPeriodLabel(period)}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-4 text-xs">{[["bg-white border", "Hari aktif"], ["bg-[#c00000]", "Sabtu/Minggu dan libur nasional"], ["bg-[#595959]", "Hari nonaktif"]].map(([color, label]) => <span key={label} className="flex items-center gap-2"><span className={`size-3 rounded-sm ${color}`} />{label}</span>)}</div>
    <div className="overflow-x-auto rounded-lg border"><table aria-label="Pratinjau daftar hadir" className="w-full min-w-[1000px] border-collapse text-xs"><thead><tr><th className="min-w-48 border p-3 text-left">Nama petugas</th>{days.map(d => <th key={d.date} className="border px-2 py-3" title={d.date}>{d.day}</th>)}<th className="min-w-20 border px-2">Aktif</th></tr></thead><tbody>{workers.map(w => <tr key={w.id}><th scope="row" className="border p-3 text-left font-medium">{w.name}</th>{days.map(d => <td key={d.date} data-day={d.day} data-state={d.state} aria-label={`${d.day}: ${d.holiday || (d.state === "active" ? "Hari aktif" : "Hari nonaktif")}`} title={`${d.date}: ${d.holiday || (d.state === "active" ? "Hari aktif" : "Hari nonaktif")}`} className="h-12 min-w-6 border border-zinc-800" style={{ backgroundColor: d.state === "active" ? "#ffffff" : d.state === "holiday" ? "#c00000" : "#595959" }} />)}<td className="border p-2 text-center">{active} hari</td></tr>)}</tbody></table></div>
    <p className="text-xs text-zinc-500">Kotak putih disediakan untuk pengisian absensi. Jadwal yang disimpan tetap sama pada unduhan ulang.</p>
  </CardContent></Card>}
  <Card><CardHeader><CardTitle>Penandatangan</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-5 lg:grid-cols-3">
    <SpjEmployeePicker label="Pengguna Anggaran" employees={options.employees} value={signers.paNip} onChange={v => selectSigner("paNip", v)} disabled={busy} />
    <SpjEmployeePicker label="PPTK" employees={options.employees} value={signers.pptkNip} onChange={v => selectSigner("pptkNip", v)} disabled={busy} />
    <SpjEmployeePicker label="Bendahara Pengeluaran" employees={options.employees} value={signers.treasurerNip} onChange={v => selectSigner("treasurerNip", v)} disabled={busy} />
  </div><div className="max-w-xs space-y-2"><Label htmlFor="spj-pa-status">Status Kepala Dinas / Pengguna Anggaran</Label><select id="spj-pa-status" disabled={busy} value={signers.paStatus} className={spjSelectClass} onChange={e => selectSigner("paStatus", e.target.value)}><option value="definitif">Definitif</option><option value="plt">Plt. (Pelaksana Tugas)</option></select></div></CardContent></Card>
  {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  {savedId ? <div role="status" className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5"><p className="font-medium text-emerald-900">SPJ tersimpan. Unduh kedua dokumen berikut.</p><SpjDownloads id={savedId} /><Button type="button" variant="outline" className={spjActionClass.primary} onClick={changed}>Buat SPJ baru</Button></div>
    : <Button type="submit" className={spjActionClass.primary} disabled={busy || !type || !workers.length || !active || !!calendarError || !signers.paNip || !signers.pptkNip || !signers.treasurerNip}><FilePlus2 className="size-4" />{busy ? "Menyimpan SPJ…" : "Simpan SPJ dan siapkan PDF"}</Button>}
  </form>;
}
