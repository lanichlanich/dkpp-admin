"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Download, FileText, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NewsDataTable } from "@/components/news/news-data-table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PdfToolDocument } from "@/lib/pdf-tools-documents";
import { pdfTools } from "@/lib/pdf-tools-config";

const operations = pdfTools.map(tool => ({ value: tool.operation, label: tool.label }));
const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

async function updateDocument(url: string, method: "PATCH" | "DELETE", name?: string) {
  const response = await fetch(url, {
    method,
    ...(name === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.message ?? "Dokumen gagal diperbarui.");
  }
}

function DocumentActions({ document }: { document: PdfToolDocument }) {
  const router = useRouter();
  const nameId = useId();
  const field = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const url = `/api/tools/documents/${document.id}`;

  function changeDialog(next: typeof dialog) {
    if (inFlight.current) return;
    setError("");
    setName(document.name);
    setDialog(next);
  }

  async function mutate(event: FormEvent, mode: "rename" | "delete") {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      await updateDocument(url, mode === "rename" ? "PATCH" : "DELETE", mode === "rename" ? name : undefined);
      setDialog(null);
      toast.success(mode === "rename" ? "Nama dokumen berhasil diubah." : "Dokumen berhasil dihapus.");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Dokumen gagal diperbarui.");
    } finally {
      setPending(false);
      inFlight.current = false;
    }
  }

  return <div className="flex items-center gap-1">
    <a href={url} download className={buttonVariants({ variant: "outline", size: "sm" })}><Download aria-hidden /> Unduh</a>
    <Dialog open={dialog === "rename"} onOpenChange={open => changeDialog(open ? "rename" : null)}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}><Pencil aria-hidden /> Ubah Nama</DialogTrigger>
      <DialogContent initialFocus={field} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Ubah Nama Dokumen</DialogTitle>
          <DialogDescription>Nama baru akan digunakan saat PDF diunduh. Isi PDF tidak berubah.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={event => void mutate(event, "rename")}>
          <div className="grid gap-2">
            <Label htmlFor={nameId}>Nama dokumen</Label>
            <Input id={nameId} ref={field} value={name} onChange={event => setName(event.target.value)} required maxLength={160} disabled={pending} aria-describedby={error ? `${nameId}-error` : undefined} aria-invalid={!!error} />
            {error && <p id={`${nameId}-error`} role="alert" className="text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Batal</DialogClose>
            <Button type="submit" disabled={pending || !name.trim()}>{pending ? "Menyimpan…" : "Simpan"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={dialog === "delete"} onOpenChange={open => changeDialog(open ? "delete" : null)}>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}><Trash2 aria-hidden /> Hapus</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus dokumen ini?</AlertDialogTitle>
          <AlertDialogDescription className="wrap-anywhere">{document.name} akan dihapus dari arsip. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <form onSubmit={event => void mutate(event, "delete")}>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>Batal</AlertDialogCancel>
            <AlertDialogAction type="submit" variant="destructive" disabled={pending}>{pending ? "Menghapus…" : "Hapus Dokumen"}</AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

const columns: LegacyColumnDef<PdfToolDocument>[] = [
  { accessorKey: "name", header: "Nama Dokumen", enableHiding: false,
    cell: ({ row }) => <div className="flex min-w-48 items-start gap-2 whitespace-normal"><FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" /><span className="max-w-sm font-medium wrap-anywhere">{row.original.name}</span></div> },
  { accessorKey: "operation", header: "Alat PDF", enableGlobalFilter: false, filterFn: "equalsString",
    cell: ({ row }) => <Badge variant="secondary">{operations.find(item => item.value === row.original.operation)?.label}</Badge> },
  { accessorKey: "createdAt", header: "Disimpan (WIB)", enableGlobalFilter: false,
    cell: ({ row }) => <time dateTime={row.original.createdAt}>{date.format(new Date(row.original.createdAt))}</time> },
  { accessorKey: "pages", header: "Halaman", enableGlobalFilter: false },
  { accessorKey: "size", header: "Ukuran", enableGlobalFilter: false, cell: ({ row }) => row.original.size >= 1024 * 1024
    ? `${number.format(row.original.size / (1024 * 1024))} MB`
    : `${number.format(row.original.size / 1024)} KB` },
  { id: "actions", header: "Aksi", enableSorting: false, enableHiding: false,
    cell: ({ row }) => <DocumentActions document={row.original} /> },
];

export function PdfToolsDocumentsTable({ documents }: { documents: PdfToolDocument[] }) {
  return <NewsDataTable data={documents} columns={columns} filters={[{ id: "operation", label: "Alat PDF", options: operations }]} label="Dokumen PDF" />;
}
