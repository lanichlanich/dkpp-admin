import { ClipboardList } from "lucide-react";
import { requireMenuAccess } from "@/lib/authorization";
import { tugasEmployees } from "@/lib/surat-tugas";
import { SuratTugasForm } from "@/components/surat-tugas/form";

export const metadata = { title: "Surat Tugas" };
export default async function SuratTugasPage() {
  await requireMenuAccess("surat-tugas");
  const employees = await tugasEmployees();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <div className="mx-auto min-w-0 max-w-5xl space-y-5">
    <header className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-100 to-card p-5 dark:border-indigo-900 dark:from-indigo-950">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-700 text-white"><ClipboardList className="size-5" aria-hidden/></span>
      <div><p className="text-sm font-medium text-muted-foreground">Persuratan</p><h1 className="text-2xl font-bold sm:text-3xl">Surat Tugas</h1><p className="mt-1 text-sm text-muted-foreground">Naskah penugasan dalam lingkup tugas dan fungsi pegawai, mengacu pada Perbup Indramayu Nomor 30 Tahun 2024.</p></div>
    </header>
    <SuratTugasForm employees={employees} today={today}/>
  </div>;
}
