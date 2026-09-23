import type { Metadata } from "next";
import { DpcpForm } from "@/components/dpcp/dpcp-form";
import { DpcpHistory } from "@/components/dpcp/dpcp-history";
import { getDpcpHistory } from "@/lib/dpcp-documents";
import { getDpcpEmployeeOptions } from "@/lib/employees";

export const metadata: Metadata = { title: "Pembuatan DPCP" };

export default async function DpcpPage() {
  const [employees, documents] = await Promise.all([getDpcpEmployeeOptions(), getDpcpHistory()]);
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm font-medium text-indigo-600">Administrasi pensiun</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Pembuatan DPCP</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Pilih pegawai PNS aktif, lengkapi data yang belum tersedia, kemudian unduh Data Perorangan Calon Penerima Pensiun dalam format Word.</p>
      </div>
      <DpcpForm employees={employees} today={today} />
      <DpcpHistory documents={documents} />
    </div>
  );
}
