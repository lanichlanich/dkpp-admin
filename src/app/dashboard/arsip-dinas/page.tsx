import type { Metadata } from "next";
import { ArsipDinas } from "@/components/arsip-dinas/arsip-dinas";
import { listArchiveDocuments } from "@/lib/arsip-dinas";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Arsip Dinas" };

export default async function ArsipDinasPage() {
  await requireUser();
  const documents = await listArchiveDocuments();
  return <div className="mx-auto max-w-6xl space-y-6">
    <div>
      <p className="text-sm font-medium text-emerald-700">Administrasi persuratan</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Arsip Dinas</h1>
      <p className="mt-2 text-sm text-zinc-500">Simpan dan temukan dokumen dinas dalam PDF. Isi metadata dengan bantuan Gemini atau lengkapi secara manual.</p>
    </div>
    <ArsipDinas initialDocuments={documents} />
  </div>;
}
