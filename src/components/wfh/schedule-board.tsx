"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, ChevronLeft, ChevronRight, FileDown, LoaderCircle, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { continueScheduleMonth, createScheduleMonth, removeScheduleEmployee, setScheduleStatus } from "@/actions/wfh-schedule";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DailyDownloads } from "@/components/wfh/daily-downloads";
import { ScheduleEmployeeDialog } from "@/components/wfh/schedule-employee-dialog";
import { TableHorizontalScroll } from "@/components/ui/table-horizontal-scroll";
import type { ScheduleEmployee, ScheduleEntry, SchedulePreview, WorkLocation } from "@/lib/wfh-schedule";

import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import type { Employee } from "@/lib/db";
import type { EmployeeOptions } from "@/lib/employees";
import { filterScheduleRows, sortScheduleRows, type ScheduleRow, type ScheduleSort, type ScheduleSortKey } from "@/lib/wfh-schedule-sorting";

const sortableColumns = [
  { key: "name", label: "Nama", width: "min-w-48" },
  { key: "nip", label: "NIP", width: "" },
  { key: "position", label: "Jabatan", width: "min-w-48" },
  { key: "unit", label: "Unit Organisasi", width: "min-w-56" },
] as const;

function shortDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function ScheduleBoard({
  period, label, dates, previous, previousPreview, next, nextExists, nextLabel, exists, sourcePeriod, entries, activeEmployees, masterEmployees, employeeOptions,
}: {
  period: string;
  label: string;
  dates: string[];
  previous: string;
  previousPreview: SchedulePreview | null;
  next: string;
  nextExists: boolean;
  nextLabel: string;
  exists: boolean;
  sourcePeriod: string | null;
  entries: ScheduleEntry[];
  activeEmployees: ScheduleEmployee[];
  masterEmployees?: Employee[];
  employeeOptions?: EmployeeOptions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyCell, setBusyCell] = useState("");
  const [showPrevious, setShowPrevious] = useState(false);
  const preview = showPrevious ? previousPreview : null;
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const masterByNip = useMemo(() => new Map(masterEmployees?.map(employee => [employee.nip, employee])), [masterEmployees]);
  const [sort, setSort] = useState<ScheduleSort | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [toRemove, setToRemove] = useState<ScheduleEmployee | null>(null), [removeError, setRemoveError] = useState("");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, WorkLocation>>({});
  const [continueOpen, setContinueOpen] = useState(false);
  const rows = useMemo(() => {
    const byNip = new Map<string, ScheduleRow>();
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
  const filtered = useMemo(() => sortScheduleRows(filterScheduleRows(rows, search, filters, statusOverrides), sort, statusOverrides), [rows, search, filters, sort, statusOverrides]);
  const filterActive = Object.values(filters).some(value => value.trim());
  const updateFilter = (key: string, value: string) => setFilters(current => ({ ...current, [key]: value }));
  function sortableHeader(key: ScheduleSortKey, label: string, className: string, date?: string) {
    const direction = sort?.key === key ? sort.direction : undefined;
    const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
    return <th key={key} scope="col" className={`px-2 py-1.5 ${className}`} aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined}>
      <Button type="button" variant="ghost" size="sm" className={`min-h-10 text-inherit hover:bg-emerald-100 focus-visible:ring-emerald-700 ${direction ? "bg-emerald-100" : ""}`} aria-label={`${label}: urutkan ${direction === "asc" ? "menurun" : "menaik"}`} onClick={() => setSort({ key, direction: direction === "asc" ? "desc" : "asc" })}>
        {date ? <span className="leading-tight">Jumat<br/>{shortDate(date)}</span> : label}<Icon aria-hidden="true" className={`size-4 ${direction ? "" : "opacity-60"}`}/>
      </Button>
      {date ? <select aria-label={`Filter status ${label}`} value={filters[key] ?? ""} onChange={event => updateFilter(key, event.target.value)} className="mt-1 block h-8 w-full rounded-md border border-emerald-300 bg-white px-1 text-xs font-normal focus-visible:ring-2 focus-visible:ring-emerald-700">
        <option value="">Semua</option><option>WFH</option><option>WFO</option>
      </select> : <Input aria-label={`Filter ${label}`} placeholder="Semua" value={filters[key] ?? ""} onChange={event => updateFilter(key, event.target.value)} className="mt-1 h-8 min-w-28 bg-white font-normal"/>}
    </th>;
  }
  const availableEmployees = activeEmployees.filter(employee => !selectedNips.has(employee.nip));
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

  function clearEmployeeOverrides(nip: string) {
    setStatusOverrides(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${nip}:`))));
  }

  function removeEmployee() {
    if (!toRemove || pending) return;
    const employee = toRemove;
    setRemoveError("");
    startTransition(async () => {
      try {
        const result = await removeScheduleEmployee(period, employee.nip, true);
        if (!result.success) { setRemoveError(result.message); return; }
        clearEmployeeOverrides(employee.nip); setToRemove(null); toast.success(result.message); router.refresh();
      } catch { setRemoveError("Pegawai gagal dihapus dari jadwal. Silakan coba lagi."); }
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

    <AlertDialog open={continueOpen} onOpenChange={setContinueOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{nextExists ? `Generate ulang daftar ${nextLabel}?` : `Lanjutkan jadwal ke ${nextLabel}?`}</AlertDialogTitle><AlertDialogDescription>Daftar {nextLabel} meneruskan rotasi {label} untuk pegawai aktif. Pada jadwal campuran, WFO di Jumat terakhir mendapat WFH di Jumat pertama. WFH di Jumat terakhir tidak wajib menjadi WFO. Pegawai yang selalu WFO tetap WFO.{nextExists ? ` Status dan perubahan manual pada ${nextLabel} akan diganti.` : ""} Setelah selesai, halaman akan membuka {nextLabel}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={continueMonth} disabled={pending}>{nextExists ? "Generate ulang" : "Lanjutkan jadwal"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

    {!exists ? <div className="rounded-xl border border-dashed bg-white p-8 text-center">
      <h2 className="text-lg font-semibold">Jadwal {label} belum dibuat</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-500">Lanjutkan giliran dari Jumat terakhir bulan sebelumnya untuk pegawai aktif. Pegawai yang selalu WFO tetap WFO. Semua status dapat diubah setelah jadwal dibuat.</p>
      <Button onClick={createMonth} disabled={pending} className="mt-5">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}Buat jadwal {label}</Button>
    </div> : <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-zinc-500">Pegawai dalam daftar</p><p className="mt-1 text-2xl font-semibold">{rows.length}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-zinc-500">Jumat bulan ini</p><p className="mt-1 text-2xl font-semibold">{dates.length}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-zinc-500">Asal jadwal</p><p className="mt-1 text-sm font-semibold">{sourcePeriod ?? "Daftar awal Oktober 2026"}</p></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
        <div className="relative w-full sm:max-w-md"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, NIP, atau unit..." aria-label="Cari pegawai dalam jadwal" className="pl-9" /></div>
        <div className="flex flex-wrap items-center gap-2">{previousPreview ? <Button type="button" variant="outline" aria-pressed={showPrevious} onClick={() => setShowPrevious(value => !value)}><CalendarClock aria-hidden="true" className="size-4"/>{showPrevious ? "Sembunyikan bulan sebelumnya" : "Lihat bulan sebelumnya"}</Button> : <span className="text-xs text-zinc-500">Belum ada jadwal bulan sebelumnya.</span>}{(filterActive || search.trim()) && <Button type="button" variant="outline" onClick={() => { setFilters({}); setSearch(""); }}>Reset filter</Button>}{sort && <Button type="button" variant="outline" onClick={() => setSort(null)}>Reset urutan</Button>}<Button type="button" disabled={pending} onClick={() => setAddOpen(true)} className="bg-emerald-700 text-white hover:bg-emerald-800"><Plus aria-hidden="true" className="size-4" />Tambah pegawai</Button></div>
      </div>

      {preview && <p className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950"><strong>Pratinjau {preview.label}</strong> · Hanya baca. Jumat terakhir ditandai. Tanda — berarti tidak ada jadwal untuk pegawai pada tanggal itu.</p>}
      <p role="status" className="text-sm text-zinc-600">{filtered.length} dari {rows.length} pegawai · Rekap mencakup seluruh daftar.</p>
      <div className="overflow-clip rounded-xl border bg-white">
        <TableHorizontalScroll label="tabel WFH/WFO" aria-label="Daftar pegawai WFH/WFO" className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-emerald-50 text-emerald-950"><tr><th scope="col" className="p-3">No</th>{sortableColumns.map(({ key, label, width }) => sortableHeader(key, label, width))}{preview?.dates.map((date, i) => <th key={date} scope="col" className={`min-w-24 p-2 text-center text-indigo-950 ${i === preview.dates.length - 1 ? "border-r-2 border-indigo-300 bg-indigo-100" : "bg-indigo-50"}`}><span className="block text-xs font-normal">{i === preview.dates.length - 1 ? "Jumat terakhir" : "Bulan lalu"}</span>{shortDate(date)}</th>)}{dates.map(date => sortableHeader(date as ScheduleSortKey, `Jumat ${shortDate(date)}`, "min-w-24 text-center", date))}<th scope="col" className="min-w-28 p-3">Aksi</th></tr></thead>
          <tbody>{filtered.map((row, index) => { const master = masterByNip.get(row.employee.nip); return <tr key={row.employee.nip} className="border-t hover:bg-zinc-50"><td className="p-3 text-zinc-500">{index + 1}</td><td className="p-3 font-medium">{row.employee.name}</td><td className="whitespace-nowrap p-3 font-mono text-xs">{row.employee.nip}</td><td className="p-3 text-xs">{row.employee.position}</td><td className="p-3 text-xs">{row.employee.unit}</td>{preview?.dates.map((date, i) => {
            const status = preview.statuses[row.employee.nip]?.[date];
            return <td key={date} className={`p-2 text-center ${i === preview.dates.length - 1 ? "border-r-2 border-indigo-300 bg-indigo-50" : "bg-indigo-50/50"}`}>
              {status ? <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${status === "WFH" ? "bg-emerald-100 text-emerald-900" : "bg-sky-100 text-sky-900"}`}>{status}</span> : <span aria-label="Tidak ada jadwal" className="text-zinc-500">—</span>}
            </td>;
          })}{dates.map((date) => { const key = `${row.employee.nip}:${date}`; const status = statusOverrides[key] ?? row.statuses[date] ?? "WFO"; return <td key={date} className="p-2 text-center"><button type="button" disabled={pending} aria-label={`${row.employee.name}, ${shortDate(date)}: ${status}. Ubah menjadi ${status === "WFH" ? "WFO" : "WFH"}`} onClick={() => changeStatus(row.employee.nip, date, status === "WFH" ? "WFO" : "WFH")} className={`inline-flex min-w-16 items-center justify-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${status === "WFH" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-sky-100 text-sky-800 hover:bg-sky-200"}`}>{busyCell === key ? <LoaderCircle className="size-3 animate-spin" /> : status === "WFH" ? "✓" : "✕"}{status}</button></td>; })}<td className="p-3"><div className="flex items-center gap-2">{master && employeeOptions && <EmployeeFormDialog employee={master} options={employeeOptions} showEditLabel/>}<Button type="button" variant="destructive" size="sm" disabled={pending} aria-label={`Hapus ${row.employee.name} dari jadwal ${label}`} onClick={() => { setToRemove(row.employee); setRemoveError(""); }}><Trash2 aria-hidden="true" className="size-3.5" />Hapus</Button></div></td></tr>; })}</tbody>
          <tfoot className="border-t bg-zinc-50 font-semibold"><tr><td colSpan={5 + (preview?.dates.length ?? 0)} className="p-3">Jumlah WFH / WFO</td>{counts.map((count, index) => <td key={dates[index]} className="p-3 text-center text-xs">{count} / {rows.length - count}</td>)}<td /></tr></tfoot>
        </TableHorizontalScroll>
        {filtered.length === 0 && <p className="p-6 text-center text-sm text-zinc-500">Pegawai tidak ditemukan.</p>}
      </div>
      <DailyDownloads period={period} totals={dates.map((date, index) => ({ date, wfh: counts[index], wfo: rows.length - counts[index] }))} />
      <p className="text-xs text-zinc-500">Klik judul kolom untuk mengurutkan daftar. Klik status pada tanggal Jumat untuk mengganti WFH ↔ WFO. Perubahan langsung disimpan untuk bulan yang dipilih.</p>
    </>}
    {addOpen && <ScheduleEmployeeDialog period={period} label={label} employees={availableEmployees} onClose={() => setAddOpen(false)} onAdded={clearEmployeeOverrides} />}
    <AlertDialog open={Boolean(toRemove)} onOpenChange={open => { if (!open && !pending) setToRemove(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus pegawai dari jadwal?</AlertDialogTitle><AlertDialogDescription>{toRemove?.name} ({toRemove?.nip}) akan dihapus dari seluruh jadwal Jumat pada {label}. Data induk pegawai dan jadwal bulan lain tetap tersimpan.</AlertDialogDescription></AlertDialogHeader>{removeError && <p role="alert" className="text-sm text-rose-700">{removeError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel><AlertDialogAction onClick={event => { event.preventDefault(); removeEmployee(); }} disabled={pending} className="bg-rose-700 text-white hover:bg-rose-800">{pending ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Menghapus…</> : "Ya, hapus dari jadwal"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
