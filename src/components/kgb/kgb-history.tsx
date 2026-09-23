import { Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { KgbDocumentHistory } from "@/lib/kgb-documents";
import { formatIndonesianDate } from "@/lib/kgb";
import { cn } from "@/lib/utils";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
}

export function KgbHistory({ documents }: { documents: KgbDocumentHistory[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Daftar Dokumen SK KGB</CardTitle>
        <CardDescription>{documents.length} dokumen tersimpan dan dapat diunduh kembali.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {documents.length === 0 ? (
          <div className="grid min-h-48 place-items-center px-6 text-center">
            <div>
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-indigo-50 text-indigo-600"><FileText className="size-5" /></span>
              <p className="mt-3 font-medium text-zinc-900">Belum ada dokumen SK KGB</p>
              <p className="mt-1 text-sm text-zinc-500">Dokumen yang baru dibuat akan muncul di sini.</p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Pegawai</TableHead>
                <TableHead>Nomor surat</TableHead>
                <TableHead>Tanggal surat</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="pr-4 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell className="pl-4">
                    <div className="max-w-64"><p className="truncate font-medium text-zinc-900">{document.employeeName}</p><p className="text-xs text-zinc-500">{document.employeeNip}</p></div>
                  </TableCell>
                  <TableCell><Badge variant="outline">800.1.11.13/{document.nomorSurat}-Sekre</Badge></TableCell>
                  <TableCell>{formatIndonesianDate(document.tglSurat)}</TableCell>
                  <TableCell><p>{dateTimeFormatter.format(new Date(document.createdAt))}</p><p className="text-xs text-zinc-500">oleh {document.createdBy}</p></TableCell>
                  <TableCell><p className="max-w-52 truncate" title={document.fileName}>{document.fileName}</p><p className="text-xs text-zinc-500">{formatFileSize(document.fileSize)}</p></TableCell>
                  <TableCell className="pr-4 text-right">
                    <a href={`/api/kgb/${document.id}/download`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                      <Download />Unduh
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
