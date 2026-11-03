"use client";
import { Fragment } from "react";
import Form from "next/form";
import Link from "next/link";
import { Search, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SPJ_ARCHIVE_PAGE_SIZES } from "@/lib/spj-archive";
import { spjPeriodLabel } from "@/lib/spj-calendar";
import type { SpjReport, SpjReportPage } from "@/lib/spj-types";
import { SpjDownloads, spjMoney, spjSelectClass } from "./shared";

const path = "/dashboard/spj-pelayanan-umum";
export function SpjArchive({ data, onRemove }: { data: SpjReportPage; onRemove: (report: SpjReport) => void }) {
  const href = (page: number, search = data.search) => `${path}?${new URLSearchParams({ tab: "reports", search, page: String(page), pageSize: String(data.pageSize) })}`;
  const first = data.total ? (data.page - 1) * data.pageSize + 1 : 0, last = Math.min(data.page * data.pageSize, data.total);
  const pages = [...new Set([1, data.page - 1, data.page, data.page + 1, data.totalPages])].filter(p => p >= 1 && p <= data.totalPages).sort((a, b) => a - b);
  return <div className="space-y-4">
    <Form action={path} scroll={false} key={`${data.search}:${data.pageSize}`} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="tab" value="reports" /><input type="hidden" name="page" value="1" />
      <div className="w-full min-w-0 space-y-2 sm:w-auto sm:min-w-64 sm:flex-1"><Label htmlFor="spj-archive-search">Cari arsip SPJ</Label><Input id="spj-archive-search" name="search" type="search" defaultValue={data.search} maxLength={100} placeholder="Cari jenis tenaga, bulan, atau tahun…" /></div>
      <Button type="submit"><Search aria-hidden="true" className="size-4" />Cari</Button>
      {data.search && <Link href={href(1, "")} scroll={false} prefetch={false} className={buttonVariants({ variant: "outline" })}>Reset</Link>}
      <div className="space-y-2 sm:ml-auto"><Label htmlFor="spj-archive-size">Baris per halaman</Label><select id="spj-archive-size" name="pageSize" defaultValue={data.pageSize} className={`${spjSelectClass} w-24`} onChange={e => e.currentTarget.form?.requestSubmit()}>{SPJ_ARCHIVE_PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}</select></div>
    </Form>
    <p className="text-sm text-zinc-500">Nama petugas, penandatangan, jadwal, dan honor tersimpan sesuai saat SPJ dibuat.</p>
    <div className="rounded-xl border bg-white"><Table aria-label="Daftar arsip SPJ"><TableHeader><TableRow><TableHead>Periode</TableHead><TableHead>Jenis tenaga</TableHead><TableHead>Hari / petugas</TableHead><TableHead>Total honor</TableHead><TableHead>Dokumen</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader><TableBody>
      {data.items.map(report => <TableRow key={report.id}><TableCell className="font-medium">{spjPeriodLabel(report.period)}</TableCell><TableCell>{report.typeName}</TableCell><TableCell>{report.activeCount} hari · {report.workerCount} petugas</TableCell><TableCell>{spjMoney(report.total)}</TableCell><TableCell><SpjDownloads id={report.id} /></TableCell><TableCell><Button type="button" size="sm" variant="outline" aria-label={`Hapus SPJ ${report.typeName} ${report.period}`} onClick={() => onRemove(report)}><Trash2 className="size-4" />Hapus</Button></TableCell></TableRow>)}
      {!data.items.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-zinc-500">{data.search ? "Tidak ada SPJ yang sesuai dengan pencarian." : "Belum ada SPJ tersimpan."}</TableCell></TableRow>}
    </TableBody></Table></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-zinc-500">Menampilkan {first.toLocaleString("id-ID")}–{last.toLocaleString("id-ID")} dari {data.total.toLocaleString("id-ID")} SPJ</p>
      <nav aria-label="Pagination arsip SPJ" className="flex flex-wrap items-center gap-1">
        {data.page > 1 ? <Link href={href(data.page - 1)} scroll={false} prefetch={false} className={buttonVariants({ variant: "outline", size: "sm" })}>Sebelumnya</Link> : <Button type="button" variant="outline" size="sm" disabled>Sebelumnya</Button>}
        {pages.map((page, i) => <Fragment key={page}>{i > 0 && page - pages[i - 1] > 1 && <span aria-hidden="true" className="px-1 text-zinc-500">…</span>}<Link href={href(page)} scroll={false} prefetch={false} aria-label={`Ke halaman ${page}`} aria-current={page === data.page ? "page" : undefined} className={buttonVariants({ variant: page === data.page ? "default" : "outline", size: "sm" })}>{page}</Link></Fragment>)}
        {data.page < data.totalPages ? <Link href={href(data.page + 1)} scroll={false} prefetch={false} className={buttonVariants({ variant: "outline", size: "sm" })}>Berikutnya</Link> : <Button type="button" variant="outline" size="sm" disabled>Berikutnya</Button>}
      </nav>
    </div>
  </div>;
}
