import type { Metadata } from "next";
import { SuratPengantarForm } from "@/components/surat-pengantar/surat-pengantar-form";
import { SuratPengantarHistory } from "@/components/surat-pengantar/surat-pengantar-history";
import { getSuratPengantarHistory } from "@/lib/surat-pengantar-documents";

export const metadata: Metadata = { title: "Pembuatan Surat Pengantar" };

export default async function SuratPengantarPage() {
  const documents = await getSuratPengantarHistory();
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm font-medium text-indigo-600">Administrasi persuratan</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Pembuatan Surat Pengantar</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Isi lima tag pada template resmi, buat dokumen Word dengan format asli, lalu unduh kembali atau hapus dokumen dari daftar arsip.</p>
      </div>
      <SuratPengantarForm today={today} />
      <SuratPengantarHistory documents={documents} />
    </div>
  );
}
