"use client";
import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LocalBackupPanel({ authorized }: { authorized: boolean }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function download() {
    setBusy(true); setError(""); setMessage(""); setProgress(null);
    try {
      const response = await fetch("/api/backups/local", { method: "POST" });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || "Download backup gagal."); }
      const expected = Number(response.headers.get("x-backup-bytes"));
      const digest = response.headers.get("x-backup-sha256");
      const reader = response.body?.getReader();
      if (!reader || !expected || !digest) throw new Error("Respons backup tidak lengkap. Coba kembali.");
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(new Uint8Array(value)); received += value.length;
        setProgress(Math.min(100, Math.floor(received / expected * 100)));
      }
      if (received !== expected) throw new Error("Unduhan terputus. Backup belum lengkap; silakan coba kembali.");
      const blob = new Blob(chunks, { type: "application/gzip" });
      const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
      if ([...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("") !== digest) throw new Error("Pemeriksaan integritas backup gagal. Silakan coba kembali.");
      const fileName = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") || "")?.[1] || "backup-dkpp-admin.tar.gz";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = fileName;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage(`Backup selesai diperiksa dan diunduh: ${response.headers.get("x-backup-tables")} tabel dan ${response.headers.get("x-backup-documents")} berkas. File: ${fileName}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Download backup gagal."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm md:p-6">
    <h2 className="text-lg font-semibold">Download backup lengkap</h2>
    <p className="text-sm leading-6 text-muted-foreground">Satu arsip .tar.gz berisi snapshot database, seluruh berkas tersimpan, manifest pemeriksaan, dan petunjuk pemulihan. Data dikelompokkan dalam folder Kepegawaian, Persuratan, Umum, Perencanaan, Perpustakaan, dan Sistem.</p>
    <p className="text-sm leading-6 text-muted-foreground">Termasuk PO, KAK, RKA sumber, dan berkas yang belum terhubung ke metadata fitur. Sesi login dan konfigurasi layanan tidak disertakan.</p>
    {!authorized && <p role="status" className="text-sm text-amber-800">Backup hanya tersedia untuk administrator yang ditetapkan.</p>}
    <Button size="lg" onClick={download} disabled={busy || !authorized}>{busy ? <LoaderCircle className="animate-spin" /> : <Download />}{busy ? progress === null ? "Menyiapkan backup..." : `Mengunduh ${progress}%...` : "Download backup ke komputer"}</Button>
    {busy && <p role="status" className="text-sm text-muted-foreground">{progress === null ? "Mengumpulkan data dan berkas. Proses dapat memerlukan beberapa menit; tetap buka halaman ini." : "Menyalin arsip dan memeriksa integritas unduhan..."}</p>}
    {message && <p role="status" className="break-words rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900">{error}</p>}
  </section>;
}
