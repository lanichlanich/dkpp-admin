import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { requireMenuAccess } from "@/lib/authorization";
import { getPltAssignments, getPltEmployees } from "@/lib/plt-assignments";
import { jakartaToday } from "@/lib/plt-dates";
import { PltList } from "@/components/plt/plt-list";

export const metadata: Metadata = { title: "Daftar Plt." };
export default async function PltPage() {
  await requireMenuAccess("daftar-plt");
  const [assignments, employees] = await Promise.all([getPltAssignments(), getPltEmployees()]);
  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-100 p-3 text-indigo-700"><CalendarClock className="size-6" /></div><div><p className="text-sm font-medium text-indigo-600">Kepegawaian</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Daftar Plt.</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Pantau masa tugas Pelaksana Tugas per tiga bulan, tindak lanjuti penugasan yang segera habis, dan simpan riwayat perpanjangannya.</p></div></div>
    <PltList assignments={assignments} employees={employees} initialToday={jakartaToday()} />
  </div>;
}
