import type { Metadata } from "next";
import { KgbForm } from "@/components/kgb/kgb-form";
import { KgbHistory } from "@/components/kgb/kgb-history";
import { getKgbEmployeeOptions } from "@/lib/employees";
import { getKgbHistory } from "@/lib/kgb-documents";

export const metadata: Metadata = { title: "Pembuatan SK KGB" };

export default async function KgbPage() {
  const [employees, documents] = await Promise.all([getKgbEmployeeOptions(), getKgbHistory()]);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm font-medium text-indigo-600">Administrasi kepegawaian</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Pembuatan SK KGB</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Lengkapi data Kenaikan Gaji Berkala. Gaji baru dihitung otomatis untuk pegawai PNS berdasarkan golongan dan masa kerja sesuai PP No. 5 Tahun 2024.
        </p>
      </div>
      <KgbForm employees={employees} />
      <KgbHistory documents={documents} />
    </div>
  );
}
