"use client";

import { Download, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIndonesianDate } from "@/lib/kgb";
import type { SuratPerbantuanHistoryItem } from "@/lib/surat-perbantuan";
import { cn } from "@/lib/utils";

const dateTime = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function SuratPerbantuanHistory({ documents }: { documents: SuratPerbantuanHistoryItem[] }) {
  return <Card>
    <CardHeader className="border-b">
      <CardTitle>Arsip Surat Perbantuan</CardTitle>
      <CardDescription>{documents.length} dokumen tersimpan dan dapat diunduh kembali.</CardDescription>
    </CardHeader>
    <CardContent className="px-0">
      {!documents.length ? <div className="grid min-h-40 place-items-center px-6 text-center">
        <div><FileText className="mx-auto size-6 text-indigo-500" /><p className="mt-3 font-medium">Belum ada surat tersimpan</p>
          <p className="mt-1 text-sm text-zinc-500">Surat perbantuan yang dibuat akan muncul di sini.</p></div>
      </div> : <div className="overflow-x-auto"><Table>
        <TableHeader><TableRow><TableHead className="pl-4">Pegawai</TableHead><TableHead>Nomor / Tanggal</TableHead>
          <TableHead>Penugasan perbantuan</TableHead><TableHead>Dibuat</TableHead><TableHead className="pr-4 text-right">Aksi</TableHead></TableRow></TableHeader>
        <TableBody>{documents.map((item) => <TableRow key={item.id}>
          <TableCell className="pl-4"><p className="font-medium">{item.employeeName}</p><p className="text-xs text-zinc-500">{item.employeeNip}</p></TableCell>
          <TableCell><p>800.1.11.1 / {item.nomorSurat} / Sekret.</p><p className="text-xs text-zinc-500">{formatIndonesianDate(item.tanggalSurat)}</p></TableCell>
          <TableCell className="min-w-56 max-w-80 whitespace-normal"><p>{item.jabatanPerbantuan}</p><p className="text-xs text-zinc-500">{item.unitKerjaPerbantuan}</p></TableCell>
          <TableCell><p>{dateTime.format(new Date(item.createdAt))}</p><p className="text-xs text-zinc-500">oleh {item.createdBy}</p></TableCell>
          <TableCell className="pr-4 text-right"><a href={`/api/surat-perbantuan/${encodeURIComponent(item.id)}/download`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))} aria-label={`Unduh surat perbantuan ${item.employeeName}`}><Download />Unduh</a></TableCell>
        </TableRow>)}</TableBody>
      </Table></div>}
    </CardContent>
  </Card>;
}
