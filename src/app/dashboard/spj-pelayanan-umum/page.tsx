import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { SpjAdmin } from "@/components/spj/admin";
import { getSpjOptions } from "@/lib/spj-service";
import { jakartaToday } from "@/lib/plt-dates";
import { requireMenuAccess } from "@/lib/authorization";
export const metadata: Metadata = { title: "SPJ Pelayanan Umum Kantor" };
export default async function SpjPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireMenuAccess("spj-pelayanan-umum");
  const params = await searchParams, options = await getSpjOptions(params);
  return <div className="mx-auto max-w-7xl space-y-6"><div><p className="text-sm font-medium text-emerald-700">Umum</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">SPJ Pelayanan Umum Kantor</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Kelola petugas dan jenis tenaga, lalu buat daftar hadir dan daftar penerimaan honor bulanan.</p></div><SpjAdmin options={options} today={jakartaToday()} initialSeed={randomUUID()} initialTab={params.tab === "reports" ? "reports" : "create"} /></div>;
}
