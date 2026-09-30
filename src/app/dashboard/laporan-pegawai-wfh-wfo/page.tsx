import type { Metadata } from "next";
import Link from "next/link";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { DailyDownloads } from "@/components/wfh/daily-downloads";
import { getScheduleEntries, getScheduleMonths, groupScheduleEntries, monthLabel, validPeriod } from "@/lib/wfh-schedule";

export const metadata: Metadata = { title: "Laporan Pegawai WFH/WFO" };

export default async function ScheduleReportPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const query = await searchParams;
  const months = await getScheduleMonths();
  const period = validPeriod(query.bulan ?? "") ? query.bulan! : months[0]?.period ?? "2026-10";
  const exists = months.some((month) => month.period === period);
  const entries = exists ? await getScheduleEntries(period) : [];
  const people = groupScheduleEntries(entries);
  const dates = [...new Set(entries.map((entry) => entry.fridayDate))].sort();
  const totals = dates.map((date) => ({ date, wfh: entries.filter((entry) => entry.fridayDate === date && entry.status === "WFH").length, wfo: entries.filter((entry) => entry.fridayDate === date && entry.status === "WFO").length }));

  return <div className="mx-auto max-w-5xl space-y-6">
    <div><p className="text-sm font-medium text-emerald-700">Kepegawaian</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Laporan Pegawai WFH/WFO</h1><p className="mt-2 text-sm text-zinc-500">Rekap bulanan berdasarkan jadwal Jumat yang tersimpan. Unduh daftar lengkap sesuai susunan contoh Excel atau laporan PDF.</p></div>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
      <span className="text-sm font-medium">Bulan:</span>
      <div className="flex flex-wrap gap-2">{months.map((month) => <Link key={month.period} href={`/dashboard/laporan-pegawai-wfh-wfo?bulan=${month.period}`} aria-current={month.period === period ? "page" : undefined} className={`rounded-lg px-3 py-1.5 text-sm ${month.period === period ? "bg-emerald-700 text-white" : "border text-zinc-700 hover:bg-zinc-50"}`}>{monthLabel(month.period)}</Link>)}</div>
    </div>
    {!exists ? <div className="rounded-xl border bg-white p-8 text-center"><p className="font-medium">Belum ada jadwal yang dapat dilaporkan.</p><Link href="/dashboard/daftar-wfh" className="mt-3 inline-block text-sm text-emerald-700 hover:underline">Buka daftar WFH/WFO</Link></div> : <>
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-5"><p className="text-xs text-zinc-500">Pegawai terjadwal</p><p className="mt-1 text-3xl font-semibold">{people.length}</p></div><div className="rounded-xl border bg-white p-5"><p className="text-xs text-zinc-500">Total penugasan WFH</p><p className="mt-1 text-3xl font-semibold text-emerald-700">{totals.reduce((sum, day) => sum + day.wfh, 0)}</p></div><div className="rounded-xl border bg-white p-5"><p className="text-xs text-zinc-500">Total penugasan WFO</p><p className="mt-1 text-3xl font-semibold text-sky-700">{totals.reduce((sum, day) => sum + day.wfo, 0)}</p></div></div>
      <div className="flex flex-wrap gap-3"><a href={`/api/wfh-schedule/${period}/pdf`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"><FileDown className="size-4" />Unduh PDF {monthLabel(period)}</a><a href={`/api/wfh-schedule/${period}/xlsx`} className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"><FileSpreadsheet className="size-4" />Unduh Excel seperti contoh</a><Link href={`/dashboard/daftar-wfh?bulan=${period}`} className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-zinc-50">Ubah daftar</Link></div>
      <DailyDownloads period={period} totals={totals} />
    </>}
  </div>;
}
