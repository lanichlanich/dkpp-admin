"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { spjArchiveQuery } from "@/lib/spj-archive";
import { spjPeriodLabel } from "@/lib/spj-calendar";
import type { SpjReport, SpjReportPage } from "@/lib/spj-types";
import { SpjDownloads, spjActionClass, spjMoney } from "./shared";
import { SpjPagination } from "./pagination";

const path = "/dashboard/spj-pelayanan-umum";
export function SpjArchive({ data, onRemove }: { data: SpjReportPage; onRemove: (report: SpjReport) => void }) {
  const router = useRouter(), [query, setQuery] = useState(data.search), [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestedSize = useRef(data.pageSize);
  const composing = useRef(false);
  const searching = pending || spjArchiveQuery({ search: query }).search !== data.search;
  const clearTimer = () => { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => {
    const restore = () => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; const params = new URLSearchParams(window.location.search); requestedSize.current = spjArchiveQuery({ pageSize: params.get("pageSize") }).pageSize; setQuery(params.get("search") ?? ""); };
    window.addEventListener("popstate", restore);
    return () => { window.removeEventListener("popstate", restore); if (timer.current !== null) clearTimeout(timer.current); };
  }, []);
  function navigate(page: number, search: string, pageSize: number, replace = true) {
    clearTimer();
    requestedSize.current = pageSize;
    const href = `${path}?${new URLSearchParams({ tab: "reports", search, page: String(page), pageSize: String(pageSize) })}`;
    startTransition(() => { if (replace) router.replace(href, { scroll: false }); else router.push(href, { scroll: false }); });
  }
  function search(value: string) {
    setQuery(value); clearTimer();
    if (!composing.current) timer.current = setTimeout(() => navigate(1, value, requestedSize.current), 300);
  }
  return <div className="space-y-4">
    <div className="space-y-2"><Label htmlFor="spj-archive-search">Cari arsip SPJ</Label><Input id="spj-archive-search" name="search" type="search" value={query} maxLength={100} placeholder="Cari jenis tenaga, bulan, atau tahun…" onChange={e => search(e.target.value)} onCompositionStart={() => { composing.current = true; clearTimer(); }} onCompositionEnd={e => { composing.current = false; search(e.currentTarget.value); }} /></div>
    {searching && <p role="status" className="text-sm text-emerald-700">Mencari arsip…</p>}
    <p className="text-sm text-zinc-500">Nama petugas, penandatangan, jadwal, dan honor tersimpan sesuai saat SPJ dibuat.</p>
    <div className="rounded-xl border bg-white" aria-busy={searching}><Table aria-label="Daftar arsip SPJ"><TableHeader><TableRow><TableHead>Periode</TableHead><TableHead>Jenis tenaga</TableHead><TableHead>Hari / petugas</TableHead><TableHead>Total honor</TableHead><TableHead>Dokumen</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader><TableBody>
      {data.items.map(report => <TableRow key={report.id}><TableCell className="font-medium">{spjPeriodLabel(report.period)}</TableCell><TableCell>{report.typeName}</TableCell><TableCell>{report.activeCount} hari · {report.workerCount} petugas</TableCell><TableCell>{spjMoney(report.total)}</TableCell><TableCell><SpjDownloads id={report.id} /></TableCell><TableCell><Button type="button" size="sm" variant="outline" className={spjActionClass.remove} aria-label={`Hapus SPJ ${report.typeName} ${report.period}`} onClick={() => onRemove(report)}><Trash2 className="size-4" />Hapus</Button></TableCell></TableRow>)}
      {!data.items.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-zinc-500">{data.search ? "Tidak ada SPJ yang sesuai dengan pencarian." : "Belum ada SPJ tersimpan."}</TableCell></TableRow>}
    </TableBody></Table></div>
    <SpjPagination id="spj-archive-size" label="arsip SPJ" itemLabel="SPJ" total={data.total} page={data.page} pageSize={data.pageSize} disabled={searching} onPageChange={page => navigate(page, query, data.pageSize, false)} onPageSizeChange={size => navigate(1, query, size)} />
  </div>;
}
