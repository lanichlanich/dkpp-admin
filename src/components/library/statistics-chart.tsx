"use client";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { LibraryMonthStatistics } from "@/lib/library-statistics-types";

const config = {
  visits: { label: "Kunjungan", color: "#059669" },
  loans: { label: "Peminjaman", color: "#2563eb" },
  returns: { label: "Pengembalian", color: "#d97706" },
} satisfies ChartConfig;
export function LibraryStatisticsChart({ data }: { data: LibraryMonthStatistics[] }) {
  const empty = data.every(row => row.visits === 0 && row.loans === 0 && row.returns === 0);
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-600">{Object.entries(config).map(([key, item]) => <span key={key} className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />{item.label}</span>)}</div>
    {empty ? <div className="grid h-64 place-items-center rounded-xl bg-zinc-50 px-6 text-center text-sm text-zinc-500">Belum ada aktivitas pada rentang 12 bulan ini.</div> : <ChartContainer config={config} className="h-72 w-full min-w-0" role="img" aria-label="Tren kunjungan, transaksi peminjaman, dan transaksi pengembalian selama 12 bulan">
      <BarChart accessibilityLayer data={data} margin={{ left: -20, right: 6, top: 12 }}>
        <CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={15} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="visits" fill="var(--color-visits)" radius={[3,3,0,0]} maxBarSize={22} />
        <Bar dataKey="loans" fill="var(--color-loans)" radius={[3,3,0,0]} maxBarSize={22} />
        <Bar dataKey="returns" fill="var(--color-returns)" radius={[3,3,0,0]} maxBarSize={22} />
      </BarChart>
    </ChartContainer>}
    <details className="text-sm text-zinc-600"><summary className="cursor-pointer font-medium text-emerald-700">Lihat data tren</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Jumlah kunjungan dan transaksi per bulan</caption><thead><tr className="border-b"><th className="py-2 pr-4">Bulan</th><th className="pr-4">Kunjungan</th><th className="pr-4">Peminjaman</th><th>Pengembalian</th></tr></thead><tbody>{data.map(row => <tr key={row.month} className="border-b last:border-0"><th scope="row" className="py-2 pr-4 font-normal">{row.label}</th><td>{row.visits}</td><td>{row.loans}</td><td>{row.returns}</td></tr>)}</tbody></table></div></details>
  </div>;
}
