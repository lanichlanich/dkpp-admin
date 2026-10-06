import type { Metadata } from "next";
import { SuratLupaAbsenPulangForm } from "@/components/surat-lupa-absen-pulang/form";
import { SuratLupaAbsenPulangHistory } from "@/components/surat-lupa-absen-pulang/history";
import { getEmployeesForSuratLupaAbsen, getSuratLupaAbsenHistory } from "@/lib/surat-lupa-absen-pulang";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Surat Lupa Absen Pulang" };

export default async function SuratLupaAbsenPulangPage() {
  await requireUser();
  const [employees, documents] = await Promise.all([
    getEmployeesForSuratLupaAbsen(),
    getSuratLupaAbsenHistory(),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta",
  }).format(new Date());

  return <div className="mx-auto max-w-6xl space-y-6">
    <div>
      <p className="text-sm font-medium text-indigo-600">Administrasi persuratan</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Surat Lupa Absen Pulang</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Buat surat dari template resmi menggunakan data pegawai aktif. Dokumen tersimpan di arsip dan dapat diunduh kembali.</p>
    </div>
    <SuratLupaAbsenPulangForm employees={employees} today={today} />
    <SuratLupaAbsenPulangHistory documents={documents} />
  </div>;
}
