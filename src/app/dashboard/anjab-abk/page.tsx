import type { Metadata } from "next";
import { requireMenuAccess } from "@/lib/authorization";
import { getAnjabPlan } from "@/lib/anjab-abk";
import { validAnjabYear } from "@/lib/anjab-abk-calculation";
import { anjabCatalog } from "@/lib/anjab-abk-source";
import { AnjabAbkAdmin } from "@/components/anjab-abk/admin";

export const metadata: Metadata = { title: "Anjab-ABK Jabatan Fungsional" };

export default async function AnjabAbkPage({ searchParams }: { searchParams: Promise<{ tahun?: string }> }) {
  await requireMenuAccess("anjab-abk");
  const query = await searchParams, candidate = Number(query.tahun);
  const year = validAnjabYear(candidate) ? candidate : anjabCatalog.baseYear;
  return <AnjabAbkAdmin key={year} catalog={anjabCatalog} initial={await getAnjabPlan(year)} />;
}
