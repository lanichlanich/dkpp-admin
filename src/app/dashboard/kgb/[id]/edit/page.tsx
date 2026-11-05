import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMenuAccess } from "@/lib/authorization";
import { getSignatoryOptions } from "@/lib/signatory-options";
import { getKgbEmployeeOptions } from "@/lib/employees";
import { getKgbEditData } from "@/lib/kgb-documents";
import { KgbForm } from "@/components/kgb/kgb-form";

export const metadata = { title: "Edit SK KGB" };
export default async function EditKgbPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMenuAccess("kgb");
  const [record, employees, signatories] = await Promise.all([getKgbEditData((await params).id), getKgbEmployeeOptions(), getSignatoryOptions()]);
  if (!record) notFound();
  const eligible = employees.some(e => e.nip === record.input.nip);
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="space-y-2"><Link href="/dashboard/kgb" className="text-sm font-medium text-indigo-700 hover:underline">← Kembali ke daftar SK KGB</Link><h1 className="text-2xl font-semibold">Edit SK KGB</h1><p className="text-sm text-zinc-500">{record.employeeName} · Versi {record.revision}. Penyimpanan memperbarui arsip yang sama dan membuat ulang Word. PDF bertanda tangan versi sebelumnya tetap tersimpan.</p></header>
    {record.legacy && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Arsip lama: data dibaca dari dokumen Word yang tersedia. Periksa kembali dan lengkapi isian yang belum terbaca sebelum menyimpan.</p>}
    {eligible ? <KgbForm employees={employees} signatories={signatories} initialInput={record.input} editing={{ id: record.id, revision: record.revision }} /> : <p role="alert" className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-900">Pegawai pada arsip ini tidak termasuk PNS aktif. Pembuatan ulang Word mengikuti persyaratan PNS aktif. Dokumen tetap dapat diunduh dan SK bertanda tangan tetap dapat diunggah melalui daftar KGB.</p>}
  </div>;
}
