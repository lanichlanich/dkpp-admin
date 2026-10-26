import type { Metadata } from "next";
import { requireMenuAccess } from "@/lib/authorization";
import { SuratPerbantuanForm } from "@/components/surat-perbantuan/form";
import { SuratPerbantuanHistory } from "@/components/surat-perbantuan/history";
import { getEmployeesForSuratPerbantuan, getSuratPerbantuanHistory } from "@/lib/surat-perbantuan";

export const metadata: Metadata = { title: "Surat Perbantuan" };

export default async function SuratPerbantuanPage() {
  await requireMenuAccess("surat-perbantuan");
  const [employees, documents] = await Promise.all([getEmployeesForSuratPerbantuan(), getSuratPerbantuanHistory()]);
  return <div className="mx-auto max-w-6xl space-y-6">
    <div>
      <p className="text-sm font-medium text-indigo-600">Administrasi persuratan</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Surat Perbantuan</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Buat surat tugas perbantuan dengan data pegawai yang tersedia. Isi tanggal dan penugasan perbantuan, lalu unduh dokumen Word.</p>
    </div>
    <SuratPerbantuanForm employees={employees} />
    <SuratPerbantuanHistory documents={documents} />
  </div>;
}
