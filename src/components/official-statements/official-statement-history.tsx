"use client";

import { useState } from "react";
import { Download, FileText, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIndonesianDate } from "@/lib/kgb";
import type { OfficialStatementDocumentHistory } from "@/lib/official-statement-documents";
import { officialStatementTypeLabels } from "@/lib/official-statement-validation";
import { cn } from "@/lib/utils";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function OfficialStatementHistory({ documents }: { documents: OfficialStatementDocumentHistory[] }) {
  const router = useRouter();
  const [documentToDelete, setDocumentToDelete] = useState<OfficialStatementDocumentHistory | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function deleteDocument() {
    if (!documentToDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/surat-hukdis-hukda/${encodeURIComponent(documentToDelete.id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({ message: "Dokumen gagal dihapus." }));
      if (!response.ok) throw new Error(payload.message ?? "Dokumen gagal dihapus.");
      setDocumentToDelete(null);
      toast.success("Dokumen berhasil dihapus.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokumen gagal dihapus.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b"><CardTitle>Daftar Surat HUKDIS dan HUKDA</CardTitle><CardDescription>{documents.length} dokumen tersimpan dan dapat diunduh atau dihapus.</CardDescription></CardHeader>
        <CardContent className="px-0">
          {documents.length === 0 ? (
            <div className="grid min-h-48 place-items-center px-6 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-full bg-indigo-50 text-indigo-600"><FileText className="size-5" /></span><p className="mt-3 font-medium text-zinc-900">Belum ada surat</p><p className="mt-1 text-sm text-zinc-500">Dokumen yang baru dibuat akan muncul di sini.</p></div></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead className="pl-4">Jenis</TableHead><TableHead>Pegawai</TableHead><TableHead>Nomor surat</TableHead><TableHead>Tanggal</TableHead><TableHead>Dibuat</TableHead><TableHead>File</TableHead><TableHead className="pr-4 text-right">Aksi</TableHead></TableRow></TableHeader>
              <TableBody>{documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell className="pl-4"><Badge variant={document.documentType === "hukdis" ? "default" : "secondary"}>{officialStatementTypeLabels[document.documentType]}</Badge></TableCell>
                  <TableCell><p className="max-w-56 truncate font-medium text-zinc-900" title={document.employeeName}>{document.employeeName}</p><p className="font-mono text-xs text-zinc-500">{document.employeeNip}</p></TableCell>
                  <TableCell className="max-w-52"><span className="block truncate" title={document.nomorSurat}>{document.nomorSurat}</span></TableCell>
                  <TableCell>{formatIndonesianDate(document.tanggalSurat)}</TableCell>
                  <TableCell><p>{dateTimeFormatter.format(new Date(document.createdAt))}</p><p className="text-xs text-zinc-500">oleh {document.createdBy}</p></TableCell>
                  <TableCell><p className="max-w-44 truncate" title={document.fileName}>{document.fileName}</p><p className="text-xs text-zinc-500">{Math.max(1, Math.round(document.fileSize / 1024)).toLocaleString("id-ID")} KB</p></TableCell>
                  <TableCell className="pr-4"><div className="flex justify-end gap-2"><a href={`/api/surat-hukdis-hukda/${document.id}/download`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}><Download />Unduh</a><Button type="button" variant="destructive" size="sm" onClick={() => setDocumentToDelete(document)} aria-label={`Hapus ${officialStatementTypeLabels[document.documentType]} nomor ${document.nomorSurat}`}><Trash2 />Hapus</Button></div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(documentToDelete)} onOpenChange={(open) => { if (!open && !deleting) setDocumentToDelete(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus dokumen ini?</AlertDialogTitle><AlertDialogDescription>{documentToDelete ? `${officialStatementTypeLabels[documentToDelete.documentType]} nomor ${documentToDelete.nomorSurat} untuk ${documentToDelete.employeeName} akan dihapus permanen.` : "Dokumen akan dihapus permanen."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleting} onClick={deleteDocument}>{deleting ? <><LoaderCircle className="animate-spin" />Menghapus...</> : <><Trash2 />Ya, hapus</>}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
}
