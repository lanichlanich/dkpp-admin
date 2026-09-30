"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, FileDown, LoaderCircle, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { addScheduleEmployee, continueScheduleMonth, createScheduleMonth, setScheduleStatus } from "@/actions/wfh-schedule";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DailyDownloads } from "@/components/wfh/daily-downloads";
import type { ScheduleEmployee, ScheduleEntry, WorkLocation } from "@/lib/wfh-schedule";

type Row = {
  employee: ScheduleEmployee;
  statuses: Record<string, WorkLocation>;
};

function shortDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function ScheduleBoard({
  period, label, dates, previous, next, nextExists, nextLabel, exists, sourcePeriod, entries, activeEmployees,
}: {
  period: string;
  label: string;
  dates: string[];
  previous: string;
  next: string;
  nextExists: boolean;
  nextLabel: string;
  exists: boolean;
  sourcePeriod: string | null;
  entries: ScheduleEntry[];
  activeEmployees: ScheduleEmployee[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyCell, setBusyCell] = useState("");
  const [search, setSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, WorkLocation>>({});
  const [continueOpen, setContinueOpen] = useState(false);
  const rows = useMemo(() => {
    const byNip = new Map<string, Row>();
    for (const entry of entries) {
      if (!byNip.has(entry.employeeNip)) {
        byNip.set(entry.employeeNip, {
          employee: { nip: entry.employeeNip, name: entry.employeeName, position: entry.position, unit: entry.unit },
          statuses: {},
        });
      }
      byNip.get(entry.employeeNip)!.statuses[entry.fridayDate] = entry.status;
    }
    return [...byNip.values()];
  }, [entries]);
  const selectedNips = new Set(rows.map((row) => row.employee.nip));
  const filtered = rows.filter((row) => `${row.employee.name} ${row.employee.nip} ${row.employee.unit}`.toLowerCase().includes(search.toLowerCase()));
  const candidates = employeeSearch.trim()
    ? activeEmployees.filter((employee) => !selectedNips.has(employee.nip) && `${employee.name} ${employee.nip}`.toLowerCase().includes(employeeSearch.toLowerCase())).slice(0, 8)
    : [];
  const counts = dates.map((date) => rows.reduce((count, row) => count + Number((statusOverrides[`${row.employee.nip}:${date}`] ?? row.statuses[date]) === "WFH"), 0));

  function createMonth() {
    startTransition(async () => {
      const result = await createScheduleMonth(period);
      if (result.success) { toast.success(result.message); router.refresh(); }
      else toast.error(result.message);
    });
  }

  function continueMonth() {
    setContinueOpen(false);
    startTransition(async () => {
      try {
        const result = await continueScheduleMonth(period);
        if (result.success) { toast.success(result.message); router.push(`/dashboard/daftar-wfh?bulan=${next}`); router.refresh(); }
        else toast.error(result.message);
      } catch { toast.error("Melanjutkan jadwal gagal. Silakan coba lagi."); }
    });
  }

  function addEmployee(nip: string) {
    startTransition(async () => {
      const result = await addScheduleEmployee(period, nip);
      if (result.success) { toast.success(result.message); setEmployeeSearch(""); router.refresh(); }
      else toast.error(result.message);
    });
  }

  function changeStatus(nip: string, date: string, status: WorkLocation) {
    const key = `${nip}:${date}`;
    setBusyCell(key);
    startTransition(async () => {
      try {
        const result = await setScheduleStatus(period, nip, date, status);
        if (result.success) { setStatusOverrides((current) => ({ ...current, [key]: status })); router.refresh(); }
        else toast.error(result.message);
      } catch { toast.error("Status gagal disimpan. Silakan coba lagi."); }
      finally { setBusyCell(""); }
    });
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
      <div className="flex items-center gap-2">
        <Link href={`/dashboard/daftar-wfh?bulan=${previous}`} aria-label="Bulan sebelumnya" className="rounded-lg border p-2 hover:bg-zinc-50"><ChevronLeft className="size-4" /></Link>
        <label className="sr-only" htmlFor="schedule-month">Pilih bulan</label>
        <Input id="schedule-month" type="month" value={period} onChange={(event) => { if (event.target.value) router.push(`/dashboard/daftar-wfh?bulan=${event.target.value}`); }} className="w-44" />
        <Link href={`/dashboard/daftar-wfh?bulan=${next}`} aria-label="Bulan berikutnya" className="rounded-lg border p-2 hover:bg-zinc-50"><ChevronRight className="size-4" /></Link>
      </div>
      {exists && <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => setContinueOpen(true)}><RefreshCw className="size-4" />{nextExists ? `Generate ulang ${nextLabel}` : `Lanjutkan ke ${nextLabel}`}</Button><Link href={`/dashboard/laporan-pegawai-wfh-wfo?bulan=${period}`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"><FileDown className="size-4" />Laporan dan unduhan</Link></div>}
    </div>

    <AlertDialog open={continueOpen} onOpenChange={setContinueOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{nextExists ? `Generate ulang daftar ${nextLabel}?` : `Lanjutkan jadwal ke ${nextLabel}?`}</AlertDialogTitle><AlertDialogDescription>Daftar {nextLabel} akan melanjutkan rotasi empat Jumat terakhir dari {label} untuk pegawai yang masih aktif.{nextExists ? ` Status dan perubahan manual pada ${nextLabel} akan diganti.` : ""} Setelah selesai, halaman akan membuka {nextLabel}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={continueMonth} disabled={pending}>{nextExists ? "Generate ulang" : "Lanjutkan jadwal"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

    {!exists ? <div className="rounded-xl border border-dashed bg-white p-8 text-center">
      <h2 className="text-lg font-semibold">Jadwal {label} belum dibuat</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-500">Lanjutkan rotasi dari empat Jumat terakhir bulan sebelumnya untuk pegawai yang masih aktif. Semua status dapat diubah setelah jadwal dibuat.</p>
      <Button onClick={createMonth} disabled={pending} className="mt-5">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}Buat jadwal {label}</Button>
    </div> : <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-zinc-500">Pegawai dalam daftar</p><p className="mt-1 text-2xl font-semibold">{rows.length}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-zinc-500">Jumat bulan ini</p><p className="mt-1 text-2xl font-semibold">{dates.length}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-zinc-500">Asal jadwal</p><p className="mt-1 text-sm font-semibold">{sourcePeriod ?? "Daftar awal Oktober 2026"}</p></div>
      </div>

      <div className="grid gap-3 rounded-xl border bg-white p-4 lg:grid-cols-2">
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, NIP, atau unit..." className="pl-9" /></div>
        <div className="relative"><Input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Tambahkan pegawai aktif berdasarkan nama atau NIP..." aria-label="Cari pegawai untuk ditambahkan" />
          {candidates.length > 0 && <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-white p-1 shadow-lg">{candidates.map((employee) => <button key={employee.nip} type="button" disabled={pending} onClick={() => addEmployee(employee.nip)} className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-emerald-50"><span>{employee.name}<span className="ml-2 text-xs text-zinc-500">{employee.nip}</span></span><Plus className="size-4 shrink-0" /></button>)}</div>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-emerald-50 text-emerald-950"><tr><th className="p-3">No</th><th className="min-w-48 p-3">Nama</th><th className="p-3">NIP</th><th className="min-w-48 p-3">Jabatan</th><th className="min-w-56 p-3">Unit Organisasi</th>{dates.map((date) => <th key={date} className="min-w-24 p-3 text-center">Jumat<br />{shortDate(date)}</th>)}</tr></thead>
          <tbody>{filtered.map((row, index) => <tr key={row.employee.nip} className="border-t hover:bg-zinc-50"><td className="p-3 text-zinc-500">{index + 1}</td><td className="p-3 font-medium">{row.employee.name}</td><td className="whitespace-nowrap p-3 font-mono text-xs">{row.employee.nip}</td><td className="p-3 text-xs">{row.employee.position}</td><td className="p-3 text-xs">{row.employee.unit}</td>{dates.map((date) => { const key = `${row.employee.nip}:${date}`; const status = statusOverrides[key] ?? row.statuses[date] ?? "WFO"; return <td key={date} className="p-2 text-center"><button type="button" disabled={pending} aria-label={`${row.employee.name}, ${shortDate(date)}: ${status}. Ubah menjadi ${status === "WFH" ? "WFO" : "WFH"}`} onClick={() => changeStatus(row.employee.nip, date, status === "WFH" ? "WFO" : "WFH")} className={`inline-flex min-w-16 items-center justify-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${status === "WFH" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-sky-100 text-sky-800 hover:bg-sky-200"}`}>{busyCell === key ? <LoaderCircle className="size-3 animate-spin" /> : status === "WFH" ? "✓" : "✕"}{status}</button></td>; })}</tr>)}</tbody>
          <tfoot className="border-t bg-zinc-50 font-semibold"><tr><td colSpan={5} className="p-3">Jumlah WFH / WFO</td>{counts.map((count, index) => <td key={dates[index]} className="p-3 text-center text-xs">{count} / {rows.length - count}</td>)}</tr></tfoot>
        </table></div>
        {filtered.length === 0 && <p className="p-6 text-center text-sm text-zinc-500">Pegawai tidak ditemukan.</p>}
      </div>
      <DailyDownloads period={period} totals={dates.map((date, index) => ({ date, wfh: counts[index], wfo: rows.length - counts[index] }))} />
      <p className="text-xs text-zinc-500">Klik status pada tanggal Jumat untuk mengganti WFH ↔ WFO. Perubahan langsung disimpan untuk bulan yang dipilih.</p>
    </>}
  </div>;
}
