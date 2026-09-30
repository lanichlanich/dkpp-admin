import type { Metadata } from "next";
import { ScheduleBoard } from "@/components/wfh/schedule-board";
import { getActiveScheduleEmployees, getScheduleEntries, getScheduleMonths, fridayDates, monthLabel, nextPeriod, validPeriod } from "@/lib/wfh-schedule";

export const metadata: Metadata = { title: "Daftar Pegawai WFH/WFO" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const query = await searchParams;
  const current = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
  const period = validPeriod(query.bulan ?? "") ? query.bulan! : current < "2026-10" ? "2026-10" : current;
  const [months, entries, activeEmployees] = await Promise.all([
    getScheduleMonths(), getScheduleEntries(period), getActiveScheduleEmployees(),
  ]);
  const month = months.find((item) => item.period === period);
  return <div className="mx-auto max-w-[100rem] space-y-6"><div><p className="text-sm font-medium text-emerald-700">Kepegawaian</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Daftar Pegawai WFH/WFO</h1><p className="mt-2 text-sm text-zinc-500">Jadwal setiap Jumat pada {monthLabel(period)}. Status WFH atau WFO dapat diubah untuk setiap pegawai dan tanggal.</p></div>
    <ScheduleBoard key={period} period={period} label={monthLabel(period)} dates={fridayDates(period)} previous={nextPeriod(period, -1)} previousExists={months.some((item) => item.period === nextPeriod(period, -1))} previousLabel={monthLabel(nextPeriod(period, -1))} next={nextPeriod(period, 1)} exists={Boolean(month)} sourcePeriod={month?.sourcePeriod ?? null} entries={entries} activeEmployees={activeEmployees} />
  </div>;
}
