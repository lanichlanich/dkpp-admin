import type { Metadata } from "next";
import { ListTree } from "lucide-react";
import { requireMenuAccess } from "@/lib/authorization";
import { getPositionMapState } from "@/lib/position-map";
import { validMapYear } from "@/lib/position-map-model";
import { jakartaToday } from "@/lib/plt-dates";
import { PositionMapEditor } from "@/components/employees/position-map-editor";

export const metadata: Metadata = { title: "Peta Jabatan" };
export default async function PositionMapPage({ searchParams }: { searchParams: Promise<{ tahun?: string }> }) {
  await requireMenuAccess("peta-jabatan");
  const { tahun } = await searchParams, defaultYear = Number(jakartaToday().slice(0, 4));
  const year = tahun && /^\d{4}$/.test(tahun) && validMapYear(Number(tahun)) ? Number(tahun) : defaultYear;
  const state = await getPositionMapState(year);
  return <div className="mx-auto min-w-0 max-w-7xl space-y-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><ListTree className="size-6" /></div><div><p className="text-sm font-medium text-emerald-700">Kepegawaian</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Peta Jabatan</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Susun kebutuhan dan bezetting setiap jabatan, lalu unduh bagan dinas beserta rincian 21 UPTD dalam DOCX A3 landscape.</p></div></div><PositionMapEditor key={year} {...state} /></div>;
}
