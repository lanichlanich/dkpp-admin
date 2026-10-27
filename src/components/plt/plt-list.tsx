"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, CalendarClock, Check, CheckCheck, ChevronsUpDown, Download, FileUp, LoaderCircle, Pencil, Plus, RotateCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { jakartaToday, nextPltDay, pltDateLabel, pltEndDate, pltSchema, pltStatus, pltTimeLabel, PLT_REMINDER_DAYS, PLT_STATUS_LABELS, type PltAssignment, type PltEmployee, type PltInput, type PltStatus } from "@/lib/plt-dates";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

const colors: Record<PltStatus, string> = {
  upcoming: "bg-sky-100 text-sky-900", active: "bg-emerald-100 text-emerald-900", expiring: "bg-amber-100 text-amber-900",
  expired: "bg-rose-100 text-rose-900", renewed: "bg-indigo-100 text-indigo-900", closed: "bg-zinc-100 text-zinc-700",
};
function useToday(initial: string) {
  const [today, setToday] = useState(initial);
  const router = useRouter();
  useEffect(() => {
    const update = () => {
      const current = jakartaToday();
      if (current !== today) { setToday(current); router.refresh(); }
    };
    const visible = () => { if (document.visibilityState === "visible") { update(); router.refresh(); } };
    update();
    const timer = setInterval(update, 60_000);
    document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [today, router]);
  return today;
}
function StatusBadge({ row, today }: { row: PltAssignment; today: string }) {
  const { status } = pltStatus(row, today);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colors[status]}`}>{PLT_STATUS_LABELS[status]}</span>;
}

export function PltReminderPanel({ assignments, initialToday }: { assignments: PltAssignment[]; initialToday: string }) {
  const today = useToday(initialToday);
  const due = assignments.filter(row => ["expired", "expiring"].includes(pltStatus(row, today).status));
  return <section aria-labelledby="plt-reminders" className={`rounded-xl border p-5 ${due.length ? "border-amber-200 bg-amber-50/60" : "border-zinc-200 bg-white"}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="plt-reminders" className="flex items-center gap-2 font-semibold text-zinc-950"><BellRing className="size-5 text-amber-700" />Pengingat masa tugas Plt.</h2><p className="mt-1 text-sm text-zinc-600">{due.length ? `${due.length} penugasan habis atau akan berakhir dalam ${PLT_REMINDER_DAYS} hari.` : "Tidak ada masa tugas yang perlu segera ditindaklanjuti."}</p></div>
      <Link href="/dashboard/daftar-plt" className="text-sm font-semibold text-indigo-700 underline-offset-4 hover:underline">Buka Daftar Plt. →</Link>
    </div>
    {due.length > 0 && <ul className="mt-4 grid gap-3 lg:grid-cols-2">{due.slice(0, 6).map(row => <li key={row.id} className="rounded-lg border border-amber-200/70 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-zinc-950">{row.employeeName}</p><StatusBadge row={row} today={today} /></div>
      <p className="mt-1 break-words text-sm text-zinc-600">{row.actingPosition} · {row.actingUnit}</p><p className="mt-2 text-sm font-medium text-amber-900">{pltTimeLabel(row, today)} · Akhir {pltDateLabel(row.endDate)}</p>
    </li>)}</ul>}
    {due.length > 6 && <p className="mt-3 text-sm text-zinc-600">Lihat {due.length - 6} pengingat lainnya di Daftar Plt.</p>}
  </section>;
}

type Editor = { row?: PltAssignment; extend?: boolean };
function PltEditor({ editor, employees, today, onClose }: { editor: Editor; employees: PltEmployee[]; today: string; onClose: () => void }) {
  const { row, extend } = editor;
  const router = useRouter();
  const [values, setValues] = useState<PltInput>({ employeeNip: row?.employeeNip ?? "", actingPosition: row?.actingPosition ?? "", actingUnit: row?.actingUnit ?? "", skNumber: extend ? "" : row?.skNumber ?? "", startDate: row ? (extend ? nextPltDay(row.endDate) : row.startDate) : today, notes: extend ? "" : row?.notes ?? "", previousId: extend ? row?.id : row?.previousId ?? "" });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [skFile, setSkFile] = useState<File | null>(null);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const selected = employees.find(employee => employee.nip === values.employeeNip);
  const endDate = pltEndDate(values.startDate);
  const linked = Boolean(values.previousId);
  function setValue(key: keyof PltInput, value: string) { setValues(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = pltSchema.safeParse(values);
    if (!parsed.success) { setErrors(parsed.error.flatten().fieldErrors); return; }
    if (!skFile && (!row || extend || !row.fileName)) { setErrors({ skFile: ["Unggah dokumen SK Plt. untuk periode ini."] }); return; }
    setSaving(true);
    try {
      const editing = row && !extend;
      const body = new FormData();
      for (const [key, value] of Object.entries(parsed.data)) if (value !== undefined) body.set(key, value);
      if (skFile) body.set("skFile", skFile);
      const response = await fetch(editing ? `/api/plt/${row.id}` : "/api/plt", { method: editing ? "PATCH" : "POST", body });
      const result = await response.json();
      if (!response.ok) { setErrors(result.errors ?? {}); throw new Error(result.message ?? "Penugasan gagal disimpan."); }
      toast.success(result.message); onClose(); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Koneksi bermasalah. Silakan coba lagi."); }
    finally { setSaving(false); }
  }
  const field = (key: keyof PltInput) => ({ id: `plt-${key}`, value: values[key] ?? "", onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValue(key, event.target.value), "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `plt-error-${key}` : undefined, disabled: saving || (linked && ["actingPosition", "actingUnit", "startDate"].includes(key)) });
  const error = (key: string) => errors[key] && <p id={`plt-error-${key}`} role="alert" className="text-xs text-destructive">{errors[key]?.[0]}</p>;
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent showCloseButton={!saving} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle>{extend ? "Perpanjang Plt. tiga bulan" : row ? "Edit penugasan Plt." : "Tambah penugasan Plt."}</DialogTitle><DialogDescription>{extend ? "Periode baru dimulai sehari setelah periode sebelumnya. Masukkan nomor SK perpanjangan; riwayat lama tetap tersimpan." : "Pilih pegawai, isi jabatan yang diampu dan tanggal mulai sesuai SK atau surat tugas."}</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2"><Label htmlFor="plt-employee">Pegawai</Label><Popover open={employeeOpen} onOpenChange={setEmployeeOpen}><PopoverTrigger render={<Button id="plt-employee" type="button" variant="outline" role="combobox" aria-expanded={employeeOpen} aria-invalid={Boolean(errors.employeeNip)} disabled={saving || linked} className="h-auto min-h-11 w-full justify-between whitespace-normal text-left" />}><span>{selected?.name ?? (row?.employeeNip === values.employeeNip ? row.employeeName : "Cari nama atau NIP pegawai…")}</span><ChevronsUpDown className="size-4 shrink-0" /></PopoverTrigger><PopoverContent className="w-[min(32rem,calc(100vw-3rem))] p-0"><Command><CommandInput placeholder="Cari nama, NIP, jabatan…" /><CommandList><CommandEmpty>Pegawai aktif tidak ditemukan.</CommandEmpty><CommandGroup>{employees.map(employee => <CommandItem key={employee.nip} value={`${employee.nip} ${employee.name} ${employee.position}`} onSelect={() => { setValue("employeeNip", employee.nip); setEmployeeOpen(false); }}><Check className={`size-4 ${values.employeeNip === employee.nip ? "opacity-100" : "opacity-0"}`} /><span><span className="block">{employee.name}</span><span className="text-xs text-zinc-500">{employee.nip} · {employee.position}</span></span></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>{error("employeeNip")}<p className="text-xs text-zinc-500">{values.employeeNip ? `NIP ${values.employeeNip}${selected ? ` · Jabatan asal: ${selected.position}` : ""}` : "Data diambil dari daftar pegawai aktif."}</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="plt-actingPosition">Jabatan Plt.</Label><Input {...field("actingPosition")} list="plt-position-options" required maxLength={200} placeholder="Contoh: Kepala Bidang…" /><datalist id="plt-position-options">{[...new Set(employees.map(employee => employee.position))].map(value => <option key={value} value={value} />)}</datalist>{error("actingPosition")}</div>
        <div className="space-y-2"><Label htmlFor="plt-actingUnit">Unit kerja Plt.</Label><Input {...field("actingUnit")} list="plt-unit-options" required maxLength={200} placeholder="Pilih atau ketik unit kerja" /><datalist id="plt-unit-options">{[...new Set(employees.map(employee => employee.unit))].map(value => <option key={value} value={value} />)}</datalist>{error("actingUnit")}</div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="plt-skNumber">Nomor SK / surat tugas</Label><Input {...field("skNumber")} required maxLength={200} placeholder="Nomor lengkap penetapan / perpanjangan" />{error("skNumber")}</div>
        <div className="space-y-2"><Label htmlFor="plt-startDate">Tanggal mulai</Label><Input {...field("startDate")} type="date" required />{error("startDate")}</div>
        <div className="space-y-2"><Label htmlFor="plt-endDate">Tanggal berakhir otomatis</Label><Input id="plt-endDate" value={endDate ? pltDateLabel(endDate) : ""} readOnly className="bg-zinc-50" /></div>
      </div>
      <div className="space-y-2 rounded-xl border p-4"><Label htmlFor="plt-skFile" className="flex items-center gap-2"><FileUp className="size-4 text-indigo-600" />Dokumen SK Plt.</Label>
        {row?.fileName && !extend && <p className="break-words text-xs text-zinc-600">Tersimpan: <a href={`/api/plt/${row.id}/download`} className="font-medium text-indigo-700 underline underline-offset-2">{row.fileName}</a>. Kosongkan unggahan untuk tetap memakai file ini.</p>}
        <Input id="plt-skFile" type="file" name="skFile" accept=".pdf,.doc,.docx" disabled={saving} required={!row || extend || !row.fileName} aria-invalid={Boolean(errors.skFile)} aria-describedby="plt-file-help" onChange={event => {
          const file = event.target.files?.[0] ?? null;
          const message = file && file.size > MAX_UPLOAD_SIZE_BYTES ? `Ukuran SK Plt. maksimal ${MAX_UPLOAD_SIZE_MB} MB.` : file && (!file.size || !/\.(pdf|doc|docx)$/i.test(file.name)) ? "Pilih file PDF, DOC, atau DOCX yang tidak kosong." : undefined;
          setErrors(current => ({ ...current, skFile: message ? [message] : undefined }));
          setSkFile(message ? null : file);
          if (message) event.currentTarget.value = "";
        }} />{error("skFile")}<p id="plt-file-help" className="text-xs leading-5 text-zinc-500">PDF, DOC, atau DOCX, maksimal {MAX_UPLOAD_SIZE_MB} MB. Unggah SK sesuai periode penugasan; perpanjangan memerlukan dokumen SK baru.</p>
      </div>
      <div className="rounded-lg bg-indigo-50 p-3 text-xs leading-5 text-indigo-900">Masa tugas tiga bulan kalender, termasuk tanggal mulai. Tanggal akhir adalah sehari sebelum tanggal yang sama tiga bulan berikutnya; tanggal yang tidak tersedia disesuaikan ke akhir bulan. Pengingat tampil mulai H-{PLT_REMINDER_DAYS} dan tetap tampil jika masa tugas habis.</div>
      <div className="space-y-2"><Label htmlFor="plt-notes">Catatan (opsional)</Label><textarea id="plt-notes" value={values.notes} onChange={event => setValue("notes", event.target.value)} disabled={saving} maxLength={1000} rows={3} className="w-full rounded-lg border border-input p-3 text-sm" placeholder="Keterangan penugasan" />{error("notes")}</div>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Batal</Button><Button type="submit" disabled={saving}>{saving && <LoaderCircle className="size-4 animate-spin" />}{saving ? "Menyimpan…" : extend ? "Simpan perpanjangan" : "Simpan penugasan"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}

export function PltList({ assignments, employees, initialToday }: { assignments: PltAssignment[]; employees: PltEmployee[]; initialToday: string }) {
  const today = useToday(initialToday);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [confirm, setConfirm] = useState<{ row: PltAssignment; action: "delete" | "close" } | null>(null);
  const [busy, setBusy] = useState(false);
  const counts = useMemo(() => assignments.reduce((result, row) => { result[pltStatus(row, today).status]++; return result; }, { upcoming: 0, active: 0, expiring: 0, expired: 0, renewed: 0, closed: 0 }), [assignments, today]);
  const filtered = assignments.filter(row => (filter === "all" || pltStatus(row, today).status === filter) && `${row.employeeName} ${row.employeeNip} ${row.actingPosition} ${row.actingUnit} ${row.skNumber}`.toLocaleLowerCase("id-ID").includes(search.toLocaleLowerCase("id-ID")));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages);
  const pageRows = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  function rowActions(row: PltAssignment) {
    return <>
      {!row.hasNext && <Button variant="outline" size="sm" onClick={() => setEditor({ row })}><Pencil className="size-3.5" />Edit</Button>}
      {!row.closedAt && !row.hasNext && <Button variant="outline" size="sm" onClick={() => setEditor({ row, extend: true })}><RotateCw className="size-3.5" />+3 bulan</Button>}
      {!row.closedAt && !row.hasNext && <Button variant="ghost" size="sm" onClick={() => setConfirm({ row, action: "close" })}><CheckCheck className="size-3.5" />Selesai</Button>}
      {!row.hasNext && <Button variant="ghost" size="sm" aria-label={`Hapus penugasan ${row.employeeName}`} onClick={() => setConfirm({ row, action: "delete" })} className="text-destructive"><Trash2 className="size-3.5" /></Button>}
    </>;
  }
  function documentLink(row: PltAssignment) {
    return row.fileName ? <a href={`/api/plt/${row.id}/download`} title={row.fileName} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 underline-offset-4 hover:underline"><Download className="size-3.5" />Unduh SK <span className="font-normal text-zinc-500">({Math.max(1, Math.ceil((row.fileSize ?? 0) / 1024))} KB)</span></a> : <p className="mt-2 text-xs text-amber-700">SK belum diunggah</p>;
  }
  async function confirmed() {
    if (!confirm) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/plt/${confirm.row.id}`, { method: confirm.action === "delete" ? "DELETE" : "PATCH", headers: { "Content-Type": "application/json" }, body: confirm.action === "close" ? JSON.stringify({ action: "close" }) : undefined });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Perubahan gagal disimpan.");
      toast.success(payload.message); setConfirm(null); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Koneksi bermasalah."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{(["active", "expiring", "expired", "upcoming"] as const).map(status => <button key={status} type="button" onClick={() => { setFilter(status); setPage(1); }} aria-pressed={filter === status} className={`rounded-xl border p-4 text-left transition-shadow hover:shadow-md ${filter === status ? "ring-2 ring-indigo-500" : ""} ${colors[status]}`}><span className="text-sm font-medium">{PLT_STATUS_LABELS[status]}</span><strong className="mt-2 block text-3xl tabular-nums">{counts[status]}</strong><span className="mt-1 block text-xs">{status === "expiring" ? `Berakhir dalam ${PLT_REMINDER_DAYS} hari` : status === "expired" ? "Perlu tindak lanjut" : status === "upcoming" ? "Jadwal mendatang" : "Lebih dari 14 hari tersisa"}</span></button>)}</div>
    <Card><CardContent className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute top-3 left-3 size-4 text-zinc-400" /><Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} aria-label="Cari penugasan Plt." placeholder="Cari pegawai, NIP, jabatan, unit, nomor SK…" className="pl-9" /></div><select aria-label="Filter status Plt." value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-input bg-white px-3 text-sm"><option value="all">Semua status</option>{Object.entries(PLT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button onClick={() => setEditor({})}><Plus className="size-4" />Tambah Plt.</Button></div>
      {assignments.length === 0 ? <div className="rounded-xl border border-dashed px-6 py-14 text-center"><CalendarClock className="mx-auto size-10 text-indigo-500" /><h2 className="mt-3 font-semibold">Belum ada penugasan Plt.</h2><p className="mx-auto mt-2 max-w-lg text-sm text-zinc-500">Tambahkan pegawai yang mendapat tugas Plt. beserta tanggal mulai sesuai SK. Tanggal akhir dan pengingat akan dihitung otomatis.</p><Button className="mt-5" onClick={() => setEditor({})}><Plus className="size-4" />Tambah penugasan pertama</Button></div> : <>
        <div className="space-y-3 md:hidden">{pageRows.map(row => <article data-plt-card key={row.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-zinc-950">{row.employeeName}</p><StatusBadge row={row} today={today} /></div>
          <p className="mt-1 text-xs text-zinc-500">{row.employeeNip}</p><p className="mt-3 break-words font-medium">{row.actingPosition}</p><p className="mt-1 break-words text-sm text-zinc-500">{row.actingUnit}</p>
          <div className="mt-3 rounded-lg bg-zinc-50 p-3"><p className="text-xs text-zinc-500">{pltDateLabel(row.startDate)} – {pltDateLabel(row.endDate)}</p><p className="mt-1 text-sm font-semibold text-zinc-900">{pltTimeLabel(row, today)}</p></div>
          <p className="mt-3 break-words text-xs text-zinc-500">SK: {row.skNumber}</p>{documentLink(row)}{row.notes && <p className="mt-1 break-words text-xs text-zinc-500">{row.notes}</p>}<div className="mt-3 flex flex-wrap gap-1.5">{rowActions(row)}</div>
        </article>)}{!filtered.length && <p className="py-8 text-center text-sm text-zinc-500">Tidak ada penugasan sesuai pencarian atau filter.</p>}</div>
        <div className="hidden overflow-x-auto md:block"><Table className="min-w-[1050px]"><TableHeader><TableRow><TableHead>Pegawai</TableHead><TableHead>Penugasan Plt.</TableHead><TableHead>Periode tiga bulan</TableHead><TableHead>Status & pengingat</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{pageRows.map(row => <TableRow key={row.id}>
          <TableCell className="max-w-60 whitespace-normal"><p className="font-medium">{row.employeeName}</p><p className="mt-1 text-xs text-zinc-500">{row.employeeNip}</p></TableCell>
          <TableCell className="max-w-72 whitespace-normal"><p className="font-medium">{row.actingPosition}</p><p className="mt-1 text-xs text-zinc-600">{row.actingUnit}</p><p className="mt-2 break-words text-xs text-zinc-500">SK: {row.skNumber}</p>{documentLink(row)}{row.notes && <p className="mt-1 break-words text-xs text-zinc-500">{row.notes}</p>}</TableCell>
          <TableCell><p>{pltDateLabel(row.startDate)}</p><p className="my-1 text-xs text-zinc-400">sampai dengan</p><p className="font-medium">{pltDateLabel(row.endDate)}</p></TableCell>
          <TableCell><StatusBadge row={row} today={today} /><p className="mt-2 text-xs text-zinc-600">{pltTimeLabel(row, today)}</p></TableCell>
          <TableCell><div className="flex flex-wrap justify-end gap-1.5">
            {rowActions(row)}
          </div></TableCell>
        </TableRow>)}{!filtered.length && <TableRow><TableCell colSpan={5} className="py-10 text-center text-zinc-500">Tidak ada penugasan sesuai pencarian atau filter.</TableCell></TableRow>}</TableBody></Table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-zinc-500"><span>{filtered.length} penugasan · Halaman {currentPage} dari {pages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Sebelumnya</Button><Button variant="outline" size="sm" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Berikutnya</Button></div></div>
      </>}
    </CardContent></Card>
    <p className="text-xs leading-5 text-zinc-500">Pengingat mengikuti tanggal WIB dan diperbarui otomatis saat hari berganti. Perpanjangan memerlukan SK / surat tugas baru dan disimpan sebagai riwayat periode berikutnya. Tandai selesai jika penugasan berakhir lebih awal.</p>
    {editor && <PltEditor editor={editor} employees={employees} today={today} onClose={() => setEditor(null)} />}
    <AlertDialog open={Boolean(confirm)} onOpenChange={open => { if (!open && !busy) setConfirm(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm?.action === "delete" ? "Hapus penugasan Plt.?" : "Tandai penugasan selesai?"}</AlertDialogTitle><AlertDialogDescription>{confirm?.row.employeeName} · {confirm?.row.actingPosition}. {confirm?.action === "delete" ? "Riwayat periode dan berkas SK ini akan dihapus permanen." : "Pengingat periode ini dihentikan. Data penugasan dan SK tetap tersimpan sebagai riwayat."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={confirmed} variant={confirm?.action === "delete" ? "destructive" : "default"}>{busy && <LoaderCircle className="size-4 animate-spin" />}{busy ? "Menyimpan…" : confirm?.action === "delete" ? "Hapus penugasan" : "Tandai selesai"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
