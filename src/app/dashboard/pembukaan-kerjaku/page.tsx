import type { Metadata } from "next";
import { PembukaanKerjakuForm } from "@/components/pembukaan-kerjaku/form";
import { getEmployeesForKerjaku, getKerjakuRequestHistory } from "@/lib/pembukaan-kerjaku";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Permohonan Pembukaan Kerjaku" };

export default async function PembukaanKerjakuPage() {
  await requireUser();
  const [employees, history] = await Promise.all([getEmployeesForKerjaku(), getKerjakuRequestHistory()]);
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date());
  return <div className="mx-auto max-w-6xl space-y-6">
    <div>
      <p className="text-sm font-medium text-emerald-700">Administrasi persuratan</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Permohonan Pembukaan Aplikasi Kerjaku</h1>
      <p className="mt-2 text-sm text-zinc-500">Buat surat dari template resmi. Lampiran mengikuti jumlah pegawai yang dipilih.</p>
    </div>
    <PembukaanKerjakuForm employees={employees} history={history} today={today} />
  </div>;
}
