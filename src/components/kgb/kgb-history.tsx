import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { KgbDocumentHistory } from "@/lib/kgb-documents";
import { formatIndonesianDate } from "@/lib/kgb";
import { KgbDocumentActions } from "./kgb-document-actions";
import { TableHorizontalScroll } from "@/components/ui/table-horizontal-scroll";
import { displayKgbLetterNumber } from "@/lib/letter-classification";

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
          <TableHorizontalScroll label="Daftar Dokumen SK KGB">
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
                  <TableCell><Badge variant="outline">{displayKgbLetterNumber(document.nomorSurat)}</Badge></TableCell>
                  <TableCell>{formatIndonesianDate(document.tglSurat)}</TableCell>
                  <TableCell><p>{dateTimeFormatter.format(new Date(document.createdAt))}</p><p className="text-xs text-zinc-500">oleh {document.createdBy}</p>{document.updatedAt && <p className="mt-1 text-xs text-amber-800">Diedit {dateTimeFormatter.format(new Date(document.updatedAt))} · v{document.revision}</p>}</TableCell>
                  <TableCell><p className="max-w-52 truncate" title={document.fileName}>{document.fileName}</p><p className="text-xs text-zinc-500">{formatFileSize(document.fileSize)} · Word v{document.revision}</p><Badge variant="outline" className={document.signedDocuments.some(file => file.documentRevision === document.revision) ? "mt-1 border-emerald-200 text-emerald-700" : "mt-1 text-zinc-500"}>{document.signedDocuments.some(file => file.documentRevision === document.revision) ? "SK TTD tersedia" : document.signedDocuments.length ? "SK TTD versi lama" : "Belum upload SK TTD"}</Badge></TableCell>
                  <TableCell className="pr-4 text-right">
                    <KgbDocumentActions key={document.revision} document={document} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableHorizontalScroll>
        )}
      </CardContent>
    </Card>
  );
}
