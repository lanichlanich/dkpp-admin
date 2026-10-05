import type { Metadata } from "next";
import { ClassificationBrowser } from "@/components/letters/classification-browser";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Klasifikasi Surat" };
export default async function ClassificationPage() {
  await requireUser();
  return <div className="mx-auto max-w-6xl space-y-6">
    <div><p className="text-sm font-medium text-emerald-700">Administrasi persuratan</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Klasifikasi Surat</h1>
      <p className="mt-2 text-sm text-zinc-500">Cari kode berdasarkan isi atau urusan surat. Kode yang sama tersedia pada seluruh form pembuatan surat bernomor.</p>
    </div><ClassificationBrowser />
  </div>;
}
