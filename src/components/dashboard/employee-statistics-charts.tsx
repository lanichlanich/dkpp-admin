"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const categoryConfig = {
  total: { label: "Pegawai", color: "#6366f1" },
} satisfies ChartConfig;

const categoryColors: Record<string, string> = {
  Struktural: "#4f46e5",
  Fungsional: "#0891b2",
  Pelaksana: "#16a34a",
  "Laki-laki": "#2563eb",
  Perempuan: "#db2777",
  "Tidak diketahui": "#71717a",
};

export function EmployeeCategoryChart({ data, label }: { data: Array<{ category: string; total: number }>; label: string }) {
  if (data.every((item) => item.total === 0)) return <EmptyChart />;
  return (
    <ChartContainer config={categoryConfig} className="h-64 w-full min-w-0" role="img" aria-label={`Distribusi ${label}: ${data.map((item) => `${item.category}: ${item.total} pegawai`).join(", ")}`}>
      <BarChart accessibilityLayer data={data} margin={{ left: 8, right: 8, top: 28 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="category" tickLine={false} tickMargin={10} axisLine={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={80}>
          {data.map((item) => <Cell key={item.category} fill={categoryColors[item.category] ?? "#6366f1"} />)}
          <LabelList dataKey="total" position="top" offset={10} className="fill-zinc-700 text-xs font-semibold" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function EmptyChart() {
  return <div className="flex h-64 items-center justify-center rounded-lg bg-zinc-50 px-6 text-center text-sm text-zinc-500">Belum ada data pegawai untuk ditampilkan.</div>;
}
