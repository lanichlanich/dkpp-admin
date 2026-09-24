"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, XAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { EmployeeStatistics } from "@/lib/employees";

const statusConfig = {
  total: { label: "Pegawai" },
  active: { label: "Aktif", color: "#10b981" },
  retired: { label: "Pensiun", color: "#f59e0b" },
  mutated: { label: "Mutasi", color: "#0ea5e9" },
} satisfies ChartConfig;

const categoryConfig = {
  total: { label: "Pegawai", color: "#6366f1" },
} satisfies ChartConfig;

export function EmployeeStatusChart({ data }: { data: EmployeeStatistics["byStatus"] }) {
  const total = data.reduce((sum, item) => sum + item.total, 0);
  if (total === 0) return <EmptyChart />;
  return (
    <div className="@container">
    <div className="grid items-center gap-5 @min-[24rem]:grid-cols-[minmax(0,1fr)_10rem]">
      <div className="relative min-w-0">
      <ChartContainer config={statusConfig} className="mx-auto h-64 w-full min-w-0 max-w-sm" role="img" aria-label={`Komposisi status dari ${total} pegawai`}>
        <PieChart accessibilityLayer>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Pie data={data} dataKey="total" nameKey="status" innerRadius={58} outerRadius={88} paddingAngle={3} strokeWidth={0}>
            {data.map((item) => <Cell key={item.status} fill={item.fill} />)}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><p className="text-2xl font-semibold tabular-nums text-zinc-950">{total.toLocaleString("id-ID")}</p><p className="text-xs text-zinc-500">pegawai</p></div>
      </div>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.status} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.status === "Aktif" ? statusConfig.active.color : item.status === "Mutasi" ? statusConfig.mutated.color : statusConfig.retired.color }} />
              {item.status}
            </div>
            <div className="text-right tabular-nums"><p className="font-semibold text-zinc-950">{item.total.toLocaleString("id-ID")}</p><p className="text-xs text-zinc-500">{Math.round(item.total / total * 100)}%</p></div>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

export function EmployeeCategoryChart({ data, label }: { data: Array<{ category: string; total: number }>; label: string }) {
  if (data.every((item) => item.total === 0)) return <EmptyChart />;
  return (
    <ChartContainer config={categoryConfig} className="h-64 w-full min-w-0" role="img" aria-label={`Distribusi ${label}: ${data.map((item) => `${item.category}: ${item.total} pegawai`).join(", ")}`}>
      <BarChart accessibilityLayer data={data} margin={{ left: 8, right: 8, top: 28 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="category" tickLine={false} tickMargin={10} axisLine={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="total" fill="var(--color-total)" radius={[6, 6, 0, 0]} maxBarSize={80}>
          <LabelList dataKey="total" position="top" offset={10} className="fill-zinc-700 text-xs font-semibold" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function EmptyChart() {
  return <div className="flex h-64 items-center justify-center rounded-lg bg-zinc-50 px-6 text-center text-sm text-zinc-500">Belum ada data pegawai untuk ditampilkan.</div>;
}
