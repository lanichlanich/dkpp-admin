"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, LoaderCircle, Pencil, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { KgbDocumentHistory } from "@/lib/kgb-documents";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";
import { formatIndonesianDate } from "@/lib/kgb";
import { nextKgbDate } from "@/lib/kgb-reminder-dates";

export function KgbDocumentActions({ document }: { document: KgbDocumentHistory }) {
  const router = useRouter(), fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [tmt, setTmt] = useState(document.tmtKgb ?? ""), [knownTmt, setKnownTmt] = useState(!!document.tmtKgb), [loadingTmt, setLoadingTmt] = useState(false);
  const [missingTmts, setMissingTmts] = useState<Record<string, string>>({});
  const downloadable = document.signedDocuments.find(f => f.documentRevision === document.revision) ?? document.signedDocuments[0];
  function changeOpen(value: boolean) {
    if (pending) return;
    setOpen(value);
    if (value) { setTmt(document.tmtKgb ?? ""); setKnownTmt(!!document.tmtKgb); setLoadingTmt(!document.tmtKgb); setError(""); setMessage(""); }
  }
  useEffect(() => {
    if (!open || document.tmtKgb) return;
    const controller = new AbortController();
    fetch(`/api/kgb/${document.id}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const data = await response.json(), value = data.input?.tmtKgbBaru;
      if (data.revision === document.revision && typeof value === "string" && nextKgbDate(value)) { setTmt(value); setKnownTmt(true); }
    }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setLoadingTmt(false); });
    return () => controller.abort();
  }, [open, document.id, document.revision, document.tmtKgb]);
  async function completeTmt(event: React.FormEvent, id: string) {
    event.preventDefault(); if (pending) return; setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/kgb/${document.id}/signed/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tmtKgb: missingTmts[id] ?? "" }) }), data = await response.json();
      if (!response.ok) throw new Error(data.message || "TMT belum tersimpan.");
      setMessage(data.message); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "TMT belum tersimpan."); }
    finally { setPending(false); }
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    setError(""); setMessage("");
    const file = fileInput.current?.files?.[0];
    if (!file) { setError("Pilih PDF SK KGB yang sudah ditandatangani."); return; }
    if (!/\.pdf$/i.test(file.name)) { setError("File SK harus berupa PDF."); return; }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) { setError(`Ukuran PDF maksimal ${MAX_UPLOAD_SIZE_MB} MB.`); return; }
    if (!nextKgbDate(tmt)) { setError("Isi TMT KGB sesuai SK yang ditandatangani."); return; }
    const form = new FormData(); form.set("file", file); form.set("revision", String(document.revision)); form.set("tmtKgb", tmt);
    setPending(true);
    try {
      const response = await fetch(`/api/kgb/${document.id}/signed`, { method: "POST", body: form }), data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unggahan belum berhasil.");
      setMessage(data.message); if (fileInput.current) fileInput.current.value = ""; router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unggahan belum berhasil. Silakan coba lagi."); }
    finally { setPending(false); }
  }
  return <div className="flex flex-wrap justify-end gap-2">
    <a href={`/dashboard/kgb/${document.id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100")}><Pencil />Edit</a>
    <a href={`/api/kgb/${document.id}/download`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100")}><Download />Unduh Word</a>
    {downloadable && <a href={`/api/kgb/${document.id}/signed/${downloadable.id}`} title={`SK bertanda tangan versi ${downloadable.documentRevision}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), downloadable.documentRevision === document.revision ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100")}><Download />Unduh SK TTD</a>}
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" />}><Upload />Upload SK TTD</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" showCloseButton={!pending}>
        <DialogHeader><DialogTitle>Upload SK KGB bertanda tangan</DialogTitle><DialogDescription>{document.employeeName} · {document.employeeNip} · Versi {document.revision}</DialogDescription></DialogHeader>
        <form onSubmit={upload} className="space-y-3">
          <label className="block space-y-2 text-sm font-medium"><span>File SK yang sudah ditandatangani</span><Input ref={fileInput} type="file" accept=".pdf,application/pdf" disabled={pending} /></label>
          <label className="block space-y-2 text-sm font-medium"><span>TMT KGB sekarang</span><Input type="date" value={tmt} onChange={e => setTmt(e.target.value)} readOnly={knownTmt} disabled={pending || loadingTmt} required /></label>
          <p className="text-xs text-indigo-800">{loadingTmt ? "Membaca TMT KGB dari dokumen…" : nextKgbDate(tmt) ? `KGB berikutnya: ${formatIndonesianDate(nextKgbDate(tmt))}` : "Isi sesuai TMT pada SK bertanda tangan. Pengingat dihitung 2 tahun kemudian."}</p>
          <p className="text-xs text-zinc-500">PDF maksimal {MAX_UPLOAD_SIZE_MB} MB. Pastikan surat sesuai dengan Word versi {document.revision}. Unggahan sebelumnya tetap tersimpan.</p>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
          <Button type="submit" disabled={pending || loadingTmt} className="w-full bg-emerald-700 hover:bg-emerald-800 sm:w-auto">{pending ? <LoaderCircle className="animate-spin" /> : <Upload />}{pending ? "Mengunggah…" : "Simpan SK bertanda tangan"}</Button>
        </form>
        <div className="space-y-3 border-t pt-4"><h3 className="font-semibold">Arsip SK bertanda tangan</h3>
          {!document.signedDocuments.length ? <p className="text-sm text-zinc-500">Belum ada SK bertanda tangan yang diunggah.</p> : document.signedDocuments.map(file => <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{file.originalName}</p><p className="mt-1 text-xs text-zinc-500">{file.pageCount} halaman · {(file.fileSize / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} KB · {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(file.createdAt))}</p><Badge variant="outline" className={file.documentRevision === document.revision ? "mt-2 border-emerald-200 text-emerald-700" : "mt-2 border-amber-200 text-amber-800"}>{file.documentRevision === document.revision ? `Sesuai versi ${file.documentRevision}` : `Versi lama (${file.documentRevision})`}</Badge></div>
            <a href={`/api/kgb/${document.id}/signed/${file.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}><Download />Unduh PDF</a>
            {file.tmtKgb ? <p className="w-full text-xs text-indigo-800">TMT {formatIndonesianDate(file.tmtKgb)} · KGB berikutnya {formatIndonesianDate(nextKgbDate(file.tmtKgb))}</p> : <form onSubmit={e => completeTmt(e, file.id)} className="w-full space-y-2 border-t pt-2"><label className="block space-y-1 text-xs"><span>TMT SK lama yang belum tercatat</span><Input type="date" required disabled={pending} value={missingTmts[file.id] ?? ""} onChange={e => setMissingTmts(v => ({ ...v, [file.id]: e.target.value }))} /></label><Button type="submit" variant="outline" size="sm" disabled={pending}>Lengkapi TMT</Button><p className="text-xs text-zinc-500">Baca TMT pada PDF ini. Data versi Word terbaru tidak dipakai untuk mengganti TMT SK lama.</p></form>}
          </div>)}
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
