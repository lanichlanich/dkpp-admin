import type { Metadata } from "next";
import { PakForm } from "@/components/pak/pak-form";
import { PakHistory } from "@/components/pak/pak-history";
import { getPakEmployeeOptions } from "@/lib/employees";
import { getPakHistory } from "@/lib/pak-documents";
export const metadata: Metadata = { title: "Pembuatan PAK" };
export default async function PakPage() {
  const [employees, documents] = await Promise.all([getPakEmployeeOptions(), getPakHistory()]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <div className="mx-auto max-w-6xl space-y-6"><div><p className="text-sm font-medium text-indigo-600">Administrasi jabatan fungsional</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Pembuatan PAK</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Susun konversi kinerja, akumulasi, dan Penetapan Angka Kredit untuk PNS aktif, mutasi, maupun pensiun. Periksa data historis dan hasil perhitungan sebelum membuat dokumen.</p></div><PakForm employees={employees} today={today} /><PakHistory documents={documents} /></div>;
}
