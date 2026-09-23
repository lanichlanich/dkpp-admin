import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, ArrowUpRight, Building2, ChartColumn, ChartPie, UserCheck, UserRoundCheck, UsersRound } from "lucide-react";
import { EmployeeAsnChart, EmployeeStatusChart } from "@/components/dashboard/employee-statistics-charts";
import { BirthdayTimelinePanel, RetirementTimelinePanel } from "@/components/dashboard/employee-timeline-panels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEmployeeStatistics, getUpcomingBirthdays, getUpcomingRetirements } from "@/lib/employees";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [statistics, upcomingRetirements, upcomingBirthdays] = await Promise.all([
    getEmployeeStatistics(),
    getUpcomingRetirements(),
    getUpcomingBirthdays(),
  ]);
  const cards = [
    { label: "Total Pegawai", value: statistics.total, description: "Seluruh data pegawai", icon: UsersRound, color: "bg-indigo-50 text-indigo-600" },
    { label: "Pegawai Aktif", value: statistics.active, description: `${statistics.activePercentage}% dari total pegawai`, icon: UserCheck, color: "bg-emerald-50 text-emerald-600" },
    { label: "Mutasi", value: statistics.mutated, description: "Status mutasi", icon: ArrowLeftRight, color: "bg-sky-50 text-sky-600" },
    { label: "Pensiun", value: statistics.retired, description: "Status pensiun", icon: UserRoundCheck, color: "bg-amber-50 text-amber-700" },
    { label: "Unit Kerja", value: statistics.units, description: "Unit kerja tercatat", icon: Building2, color: "bg-violet-50 text-violet-600" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
        <p className="text-sm font-medium text-indigo-600">Ringkasan</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Statistik Pegawai</h1>
        <p className="mt-2 text-sm text-zinc-500">Gambaran singkat data kepegawaian saat ini.</p>
        </div>
        <Link href="/dashboard/pegawai" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
          <UsersRound aria-hidden="true" className="size-4 shrink-0" />Lihat daftar pegawai<ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
        {cards.map((item) => (
          <Card key={item.label} className="min-w-0 shadow-sm">
            <CardContent>
              <div className="flex items-start justify-between gap-2">
                <p className="pt-1 text-sm font-medium text-zinc-600">{item.label}</p>
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${item.color}`}>
                  <item.icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
                </div>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-zinc-950">{item.value.toLocaleString("id-ID")}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0 shadow-sm">
          <CardHeader>
            <CardTitle><h2 className="flex items-center gap-2"><ChartPie aria-hidden="true" className="size-4 shrink-0 text-indigo-600" />Komposisi Status</h2></CardTitle>
            <CardDescription>Distribusi pegawai aktif, mutasi, dan pensiun.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmployeeStatusChart data={statistics.byStatus} />
          </CardContent>
        </Card>
        <Card className="min-w-0 shadow-sm">
          <CardHeader>
            <CardTitle><h2 className="flex items-center gap-2"><ChartColumn aria-hidden="true" className="size-4 shrink-0 text-indigo-600" />Komposisi ASN</h2></CardTitle>
            <CardDescription>Jumlah pegawai berdasarkan jenis ASN.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmployeeAsnChart data={statistics.byAsnType} />
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <RetirementTimelinePanel employees={upcomingRetirements} />
        <BirthdayTimelinePanel employees={upcomingBirthdays} />
      </div>
    </div>
  );
}
