import type { Metadata } from "next";
import { Network } from "lucide-react";
import { PositionTree } from "@/components/job-positions/position-tree";
import { getJobPositions } from "@/lib/job-positions";

export const metadata: Metadata = { title: "Daftar Jabatan" };

export default async function JobPositionsPage() {
  const positions = await getJobPositions();
  const activePositions = positions.filter((position) => position.activeEmployeeCount > 0).length;
  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-medium text-indigo-600">Kepegawaian</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Daftar Jabatan</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Atur hubungan atasan dan bawahan. Jabatan terhubung dengan penempatan pegawai berdasarkan nama jabatan dan unit kerja.</p></div>
      <div className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm"><Network className="size-4 text-indigo-600" /><span><strong className="text-zinc-900">{positions.length}</strong> penempatan jabatan · <strong className="text-zinc-900">{activePositions}</strong> sedang terisi</span></div>
    </div>
    <PositionTree positions={positions} />
  </div>;
}
