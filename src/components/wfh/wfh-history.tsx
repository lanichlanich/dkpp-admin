"use client";

import { useState } from "react";
import { Download, FileText, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIndonesianDate } from "@/lib/kgb";
import type { WfhDocumentHistory } from "@/lib/wfh-documents";
import { cn } from "@/lib/utils";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
}

export function WfhHistory({ documents }: { documents: WfhDocumentHistory[] }) {
  const router = useRouter();
  const [documentToDelete, setDocumentToDelete] = useState<WfhDocumentHistory | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function deleteDocument() {
    if (!documentToDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/wfh/${encodeURIComponent(documentToDelete.id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({ message: "Surat tugas WFH gagal dihapus." }));
      if (!response.ok) throw new Error(payload.message ?? "Surat tugas WFH gagal dihapus.");
      setDocumentToDelete(null);
      toast.success("Surat tugas WFH berhasil dihapus.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Surat tugas WFH gagal dihapus.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Daftar Surat Tugas WFH</CardTitle>
          <CardDescription>{documents.length} dokumen tersimpan dan dapat diunduh atau dihapus.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {documents.length === 0 ? (
            <div className="grid min-h-48 place-items-center px-6 text-center">
              <div>
                <span className="mx-auto grid size-11 place-items-center rounded-full bg-indigo-50 text-indigo-600"><FileText className="size-5" /></span>
                <p className="mt-3 font-medium text-zinc-900">Belum ada surat tugas WFH</p>
                <p className="mt-1 text-sm text-zinc-500">Dokumen yang baru dibuat akan muncul di sini.</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Nomor surat</TableHead>
                  <TableHead>Bulan WFH</TableHead>
                  <TableHead>Tanggal surat</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="pr-4 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell className="max-w-64 pl-4 font-medium text-zinc-900"><span className="block truncate" title={document.nomorSurat}>{document.nomorSurat}</span></TableCell>
                    <TableCell>{document.bulanWfh}</TableCell>
                    <TableCell>{formatIndonesianDate(document.tanggalSurat)}</TableCell>
                    <TableCell>
                      <p>{dateTimeFormatter.format(new Date(document.createdAt))}</p>
                      <p className="text-xs text-zinc-500">oleh {document.createdBy}</p>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-48 truncate" title={document.fileName}>{document.fileName}</p>
                      <p className="text-xs text-zinc-500">{formatFileSize(document.fileSize)}</p>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-2">
                        <a href={`/api/wfh/${document.id}/download`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}><Download />Unduh</a>
                        <Button type="button" variant="destructive" size="sm" onClick={() => setDocumentToDelete(document)} aria-label={`Hapus surat nomor ${document.nomorSurat}`}><Trash2 />Hapus</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(documentToDelete)} onOpenChange={(open) => { if (!open && !deleting) setDocumentToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus surat tugas WFH ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {documentToDelete
                ? `Surat nomor ${documentToDelete.nomorSurat} untuk bulan ${documentToDelete.bulanWfh} (${documentToDelete.fileName}) akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`
                : "Surat tugas WFH akan dihapus permanen."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={deleteDocument}>
              {deleting ? <><LoaderCircle className="animate-spin" />Menghapus...</> : <><Trash2 />Ya, hapus</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
