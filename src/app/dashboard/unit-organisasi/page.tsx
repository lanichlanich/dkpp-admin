import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { OrganizationUnitList } from "@/components/organization-units/organization-unit-list";
import { getOrganizationUnits } from "@/lib/organization-units";

export const metadata: Metadata = { title: "Daftar Unit Organisasi" };

export default async function OrganizationUnitsPage() {
  const units = await getOrganizationUnits();
  const linkedUnits = units.filter((unit) => unit.positionCount > 0).length;
  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-medium text-indigo-600">Kepegawaian</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Daftar Unit Organisasi</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Kelola unit kerja dan susun unit induknya. Katalog ini terhubung dengan penempatan jabatan serta data pegawai.</p></div>
      <div className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm"><Building2 className="size-4 text-emerald-700" /><span><strong className="text-zinc-900">{units.length}</strong> unit · <strong className="text-zinc-900">{linkedUnits}</strong> digunakan jabatan</span></div>
    </div>
    <OrganizationUnitList units={units} />
  </div>;
}
