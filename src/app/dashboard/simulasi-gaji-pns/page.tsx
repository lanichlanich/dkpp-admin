import type { Metadata } from "next";
import { requireMenuAccess } from "@/lib/authorization";
import { PnsSalarySimulator } from "@/components/finance/pns-salary-simulator";

export const metadata: Metadata = { title: "Simulasi Gaji PNS" };

export default async function PnsSalaryPage() {
  await requireMenuAccess("simulasi-gaji-pns");
  return <div className="mx-auto max-w-6xl space-y-6">
    <div><p className="text-sm font-medium text-emerald-600">Keuangan</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Simulasi Gaji PNS</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Hitung penghasilan bulanan berdasarkan PP No. 5 Tahun 2024, tunjangan, dan potongan pegawai. Hasil diperbarui langsung saat isian berubah, tanpa TPP/tukin.</p></div>
    <PnsSalarySimulator />
  </div>;
}
