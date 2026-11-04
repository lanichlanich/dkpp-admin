"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileDown, FileText, LoaderCircle, Upload } from "lucide-react";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";
import type { ScheduleLetter } from "@/lib/wfh-schedule-letters";

export function ScheduleLetterUpload({ period, month, letters }: { period: string; month: string; letters: ScheduleLetter[] }) {
  const router = useRouter(), form = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (!file) { setError("Pilih PDF surat tugas yang sudah ditandatangani."); return; }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) { setError(`Ukuran PDF maksimal ${MAX_UPLOAD_SIZE_MB} MB.`); return; }
    setPending(true);
    try {
      const data = new FormData(); data.set("file", file);
      const response = await fetch(`/api/wfh-schedule/${period}/letter`, { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Surat tugas gagal diunggah.");
      setMessage(result.message); setFile(null); form.current?.reset(); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Surat tugas gagal diunggah. Silakan coba lagi."); }
    finally { setPending(false); }
  }

  return <section aria-labelledby="schedule-letter-title" className="overflow-hidden rounded-xl border bg-white">
    <div className="border-b bg-sky-50 p-4">
      <h2 id="schedule-letter-title" className="flex items-center gap-2 font-semibold text-sky-950"><FileText className="size-5" />Surat tugas WFH/WFO</h2>
      <p className="mt-1 text-sm text-sky-900">Unggah surat tugas yang sudah ditandatangani untuk {month}, lalu unduh gabungannya dengan daftar pegawai bulan ini.</p>
    </div>
    <div className="space-y-4 p-4">
      <form ref={form} onSubmit={upload} className="space-y-3" aria-busy={pending}>
        <div><label htmlFor="schedule-letter-file" className="mb-2 block text-sm font-medium">PDF surat tugas bertanda tangan</label>
          <input id="schedule-letter-file" name="file" type="file" accept="application/pdf,.pdf" required disabled={pending}
            aria-describedby="schedule-letter-help" onChange={event => { setFile(event.target.files?.[0] ?? null); setError(""); setMessage(""); }}
            className="block w-full min-w-0 rounded-lg border p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-sky-100 file:px-3 file:py-1.5 file:text-sky-900 disabled:opacity-60" />
          <p id="schedule-letter-help" className="mt-2 text-xs text-zinc-500">Maksimal {MAX_UPLOAD_SIZE_MB} MB. Halaman surat ditempatkan lebih dahulu, diikuti daftar pegawai. Lampiran mengikuti jadwal terbaru saat diunduh.</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        <button type="submit" disabled={pending || !file} className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}{pending ? "Mengunggah surat…" : "Unggah surat tugas"}
        </button>
      </form>
      <div className="space-y-3 border-t pt-4">
        {!letters.length ? <p className="text-sm text-zinc-500">Belum ada surat tugas yang diunggah untuk {month}.</p> : letters.map(letter => {
          const base = `/api/wfh-schedule/${period}/letter/${letter.id}`;
          return <div key={letter.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0"><p className="break-all text-sm font-medium">{letter.originalName}</p><p className="mt-1 text-xs text-zinc-500">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(letter.createdAt))} · {letter.pageCount} halaman surat · {Math.ceil(letter.fileSize / 1024)} KB</p></div>
            <div className="flex flex-wrap gap-2">
              <a href={`${base}/original`} className="inline-flex items-center gap-2 rounded-lg border border-sky-200 px-3 py-2 text-xs font-medium text-sky-800 hover:bg-sky-50"><FileDown className="size-4" />Unduh surat asli</a>
              <a href={`${base}/combined`} className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-3 py-2 text-xs font-medium text-white hover:bg-violet-800"><FileDown className="size-4" />Unduh surat + daftar pegawai</a>
            </div>
          </div>;
        })}
        {!!letters.length && <p className="text-xs text-zinc-500">Untuk verifikasi tanda tangan elektronik (TTE), gunakan surat asli. PDF gabungan merupakan salinan surat beserta lampiran.</p>}
      </div>
    </div>
  </section>;
}
