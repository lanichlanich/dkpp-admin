"use client";

import { useState, useTransition } from "react";
import { Archive, CheckCircle2, CloudUpload, ExternalLink, Info, LoaderCircle } from "lucide-react";
import { checkGoogleDriveBackupAction, runGoogleDriveBackupAction, type BackupActionResult } from "@/actions/backups";
import { Button } from "@/components/ui/button";

export function GoogleDriveBackupPanel({ configured }: { configured: boolean }) {
  const [pending, startTransition] = useTransition();
  const [operation, setOperation] = useState<"backup" | "check">("backup");
  const [result, setResult] = useState<BackupActionResult | null>(null);

  function createBackup() {
    setResult(null);
    setOperation("backup");
    startTransition(async () => {
      setResult(await runGoogleDriveBackupAction());
    });
  }

  function checkConnection() {
    setResult(null);
    setOperation("check");
    startTransition(async () => {
      setResult(await checkGoogleDriveBackupAction());
    });
  }

  return <div className="space-y-5">
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CloudUpload className="size-6" /></span>
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Backup sekarang</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">Salin snapshot database dan berkas Supabase Storage ke Google Drive. Setiap backup membuat folder baru dengan tanggal dan waktu WIB.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Button onClick={createBackup} disabled={pending || !configured} size="lg">
            {pending && operation === "backup" ? <><LoaderCircle className="animate-spin" />Menyiapkan backup...</> : <><CloudUpload />Mulai backup</>}
          </Button>
          <Button onClick={checkConnection} disabled={pending || !configured} size="lg" variant="outline">
            {pending && operation === "check" ? <><LoaderCircle className="animate-spin" />Memeriksa koneksi...</> : <>Periksa koneksi</>}
          </Button>
        </div>
      </div>
      {!configured && <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <p className="font-semibold">Konfigurasi Google Drive belum lengkap.</p>
      <p className="mt-1">Isi variabel OAuth Google Drive dan daftar administrator yang diizinkan pada environment Vercel. Panduan lengkap ada di <code className="rounded bg-amber-100 px-1">docs/backup-google-drive.md</code>.</p>
      </div>}
      {configured && <p className="mt-4 text-xs text-zinc-500">Backup memerlukan waktu sesuai jumlah dan ukuran berkas. Jangan tutup halaman sampai hasilnya muncul.</p>}
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-2 font-semibold text-zinc-900"><Archive className="size-5 text-emerald-700" />Arsip tanpa enkripsi</div>
        <p className="mt-2 text-sm leading-6 text-zinc-600">Lima arsip .tar.gz dapat diekstrak langsung: Kepegawaian, Persuratan, Umum, Perencanaan, dan Sistem. Folder Drive harus memakai Akses umum Dibatasi karena arsip memuat data aplikasi dan berkas asli.</p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-2 font-semibold text-zinc-900"><Info className="size-5 text-sky-700" />Data yang dicadangkan</div>
        <p className="mt-2 text-sm leading-6 text-zinc-600">Data tabel dicatat sebagai JSON, seluruh berkas bucket disertakan termasuk file tanpa metadata fitur, dan snapshot database dibaca konsisten. Sesi login tidak disertakan karena bersifat sementara.</p>
      </div>
    </section>

    {result && <section role={result.status === "success" ? "status" : "alert"} className={`rounded-2xl border p-5 ${result.status === "success" ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70"}`}>
      <div className="flex items-start gap-3">
        {result.status === "success" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" /> : <Info className="mt-0.5 size-5 shrink-0 text-rose-700" />}
        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${result.status === "success" ? "text-emerald-950" : "text-rose-950"}`}>{result.message}</p>
          {result.status === "success" && result.backupId && <>
            <p className="mt-2 text-sm text-emerald-900">Folder <span className="font-mono">{result.backupId}</span> · {result.tableCount} tabel · {result.documentCount} berkas terhubung · {result.unlinkedStorageObjectCount} objek Storage tak terhubung · {result.archiveCount} arsip fitur</p>
            {result.folderUrl && <a href={result.folderUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 underline underline-offset-4">Buka backup di Google Drive<ExternalLink className="size-4" /></a>}
          </>}
        </div>
      </div>
    </section>}
  </div>;
}
