"use client";

import { Download, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIndonesianDate } from "@/lib/kgb";
import type { SuratLupaAbsenHistoryItem } from "@/lib/surat-lupa-absen-pulang";
import { cn } from "@/lib/utils";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

function formatFileSize(bytes: number) {
  return `${(bytes / 1024).toLocaleString("id-ID", { maximumFractionDigits: 0 })} KB`;
}

export function SuratLupaAbsenPulangHistory({ documents }: { documents: SuratLupaAbsenHistoryItem[] }) {
  return <Card>
    <CardHeader className="border-b">
      <CardTitle>Arsip Surat Lupa Absen Pulang</CardTitle>
      <CardDescription>{documents.length} dokumen tersimpan dan dapat diunduh kembali.</CardDescription>
    </CardHeader>
    <CardContent className="px-0">
      {!documents.length ? <div className="grid min-h-48 place-items-center px-6 text-center">
        <div><span className="mx-auto grid size-11 place-items-center rounded-full bg-indigo-50 text-indigo-600"><FileText className="size-5" /></span>
          <p className="mt-3 font-medium text-zinc-900">Belum ada surat tersimpan</p><p className="mt-1 text-sm text-zinc-500">Surat yang dibuat akan muncul di sini.</p></div>
      </div> : <div className="overflow-x-auto"><Table>
        <TableHeader><TableRow><TableHead className="pl-4">Pegawai</TableHead><TableHead>Tanggal lupa absen</TableHead><TableHead>Tanggal surat</TableHead><TableHead>Atasan</TableHead><TableHead>Dibuat</TableHead><TableHead>File</TableHead><TableHead className="pr-4 text-right">Aksi</TableHead></TableRow></TableHeader>
        <TableBody>{documents.map((item) => <TableRow key={item.id}>
          <TableCell className="max-w-56 pl-4"><span className="block truncate font-medium text-zinc-900" title={item.employeeName}>{item.employeeName}</span><span className="text-xs text-zinc-500">{item.employeeNip}</span></TableCell>
          <TableCell>{formatIndonesianDate(item.absenceDate)}</TableCell><TableCell>{formatIndonesianDate(item.letterDate)}</TableCell>
          <TableCell className="max-w-48 truncate" title={item.supervisorName}>{item.supervisorName}</TableCell>
          <TableCell><p>{dateTimeFormatter.format(new Date(item.createdAt))}</p><p className="text-xs text-zinc-500">oleh {item.createdBy}</p></TableCell>
          <TableCell><p className="max-w-44 truncate" title={item.fileName}>{item.fileName}</p><p className="text-xs text-zinc-500">{formatFileSize(item.fileSize)}</p></TableCell>
          <TableCell className="pr-4"><div className="flex justify-end"><a href={`/api/surat-lupa-absen-pulang/${encodeURIComponent(item.id)}/download`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}><Download />Unduh</a></div></TableCell>
        </TableRow>)}</TableBody>
      </Table></div>}
    </CardContent>
  </Card>;
}
