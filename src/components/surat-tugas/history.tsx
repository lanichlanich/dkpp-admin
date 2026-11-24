"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Files, LoaderCircle, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIndonesianDate } from "@/lib/kgb";
import type { SuratTugasHistoryItem } from "@/lib/surat-tugas-documents";

export type SuratTugasHistoryRow = Omit<SuratTugasHistoryItem, "userId"> & { canDelete: boolean };
const pageSize = 10;
const jakartaTime = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function SuratTugasHistory({ documents }: { documents: SuratTugasHistoryRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SuratTugasHistoryRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const busy = useRef(false);
  const query = search.trim().toLocaleLowerCase("id-ID");
  const filtered = documents.filter(row => (!date || row.tanggalSurat === date) && (!query || [row.nomorSurat, row.penugasan, row.createdBy].some(text => text.toLocaleLowerCase("id-ID").includes(query))));
  const last = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, last);
  async function remove() {
    if (!selected || busy.current) return;
    busy.current = true;
    setDeleting(true);
    try {
      const response = await fetch(`/api/surat-tugas/${selected.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok && response.status !== 404) throw new Error(payload?.message || "Surat Tugas gagal dihapus.");
      setSelected(null);
      toast.success(response.status === 404 ? "Surat Tugas sudah tidak ada di daftar." : "Surat Tugas dihapus dari daftar.");
      router.refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Surat Tugas gagal dihapus."); }
    finally { busy.current = false; setDeleting(false); }
  }
  return <>
    <Card id="daftar-surat-tugas" className="min-w-0 scroll-mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Files className="size-4 text-indigo-600" aria-hidden/> Daftar Surat Tugas</CardTitle>
        <CardDescription>Arsip Word yang dibuat sejak fitur daftar aktif. Dokumen belum bertanda tangan elektronik.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        {documents.length > 0 && <div className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-0 flex-1 gap-1 text-sm font-medium">Cari surat<span className="relative"><Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" aria-hidden/><Input type="search" value={search} maxLength={120} className="pl-8" placeholder="Nomor, penugasan, atau pembuat" onChange={e => { setSearch(e.target.value); setPage(1); }}/></span></label>
          <label className="grid gap-1 text-sm font-medium">Tanggal surat<Input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }}/></label>
          <Button type="button" variant="outline" disabled={!search && !date} onClick={() => { setSearch(""); setDate(""); setPage(1); }}>Reset filter</Button>
        </div>}
        {!filtered.length ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{documents.length ? "Tidak ada surat yang cocok dengan filter." : "Belum ada Surat Tugas. Dokumen baru akan tersimpan di sini."}</p> :
          <div className="min-w-0 overflow-hidden rounded-lg border">
            <Table className="min-w-[720px]" containerProps={{ tabIndex: 0, "aria-label": "Tabel arsip Surat Tugas" }}>
              <TableHeader><TableRow><TableHead className="pl-3">Nomor surat</TableHead><TableHead>Tanggal</TableHead><TableHead>Penugasan</TableHead><TableHead>Pegawai</TableHead><TableHead>Dibuat</TableHead><TableHead className="pr-3 text-right">Aksi</TableHead></TableRow></TableHeader>
              <TableBody>{filtered.slice((current - 1) * pageSize, current * pageSize).map(row => <TableRow key={row.id}>
                <TableCell className="max-w-44 pl-3 font-medium whitespace-normal wrap-anywhere">{row.nomorSurat}</TableCell>
                <TableCell>{formatIndonesianDate(row.tanggalSurat)}</TableCell>
                <TableCell className="min-w-40 max-w-64 whitespace-normal wrap-anywhere">{row.penugasan}</TableCell>
                <TableCell>{row.recipientCount} orang</TableCell>
                <TableCell><p>{jakartaTime.format(new Date(row.createdAt))}</p><p className="max-w-36 whitespace-normal wrap-anywhere text-xs text-muted-foreground">{row.createdBy}</p></TableCell>
                <TableCell className="pr-3"><div className="flex justify-end gap-2"><a href={`/api/surat-tugas/${row.id}/download`} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label={`Unduh surat nomor ${row.nomorSurat}`}><Download aria-hidden/> Unduh</a>{row.canDelete && <Button type="button" variant="destructive" size="sm" aria-label={`Hapus surat nomor ${row.nomorSurat}`} onClick={() => setSelected(row)}><Trash2 aria-hidden/> Hapus</Button>}</div></TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div>}
        {documents.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><p role="status">{filtered.length} dari {documents.length} surat</p>{last > 1 && <div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" disabled={current <= 1} aria-label="Halaman sebelumnya" onClick={() => setPage(current - 1)}><ChevronLeft aria-hidden/></Button><span>Halaman {current} dari {last}</span><Button type="button" variant="outline" size="icon" disabled={current >= last} aria-label="Halaman berikutnya" onClick={() => setPage(current + 1)}><ChevronRight aria-hidden/></Button></div>}</div>}
      </CardContent>
    </Card>
    <AlertDialog open={!!selected} onOpenChange={open => { if (!open && !deleting) setSelected(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus Surat Tugas?</AlertDialogTitle><AlertDialogDescription>Arsip Word untuk nomor {selected?.nomorSurat} akan dihapus. Salinan yang sudah diunduh atau ditandatangani di luar aplikasi tidak ikut terhapus.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel><Button type="button" variant="destructive" disabled={deleting} onClick={remove}>{deleting ? <LoaderCircle className="animate-spin" aria-hidden/> : <Trash2 aria-hidden/>} {deleting ? "Menghapus…" : "Ya, hapus"}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
