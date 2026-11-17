import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { requireMenuAccess } from "@/lib/authorization";
import { getProjectionEmployees } from "@/lib/retirement-projection-data";
import { jakartaToday } from "@/lib/plt-dates";
import { RetirementProjectionPanel } from "@/components/employees/retirement-projection-panel";

export const metadata: Metadata = { title: "Proyeksi Pensiun" };
export default async function RetirementProjectionPage() {
  await requireMenuAccess("proyeksi-pensiun");
  const employees = await getProjectionEmployees();
  return <div className="mx-auto min-w-0 max-w-7xl space-y-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-100 p-3 text-indigo-700"><CalendarClock className="size-6" /></div><div><p className="text-sm font-medium text-indigo-600">Kepegawaian</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Proyeksi Pensiun Pegawai</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Rencanakan kebutuhan pengganti untuk lima tahun mendatang berdasarkan peta jabatan DKPP 2026 dan pegawai aktif.</p></div></div><RetirementProjectionPanel employees={employees} today={jakartaToday()} /></div>;
}
