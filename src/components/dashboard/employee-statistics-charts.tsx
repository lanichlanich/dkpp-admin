"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const categoryConfig = {
  total: { label: "Pegawai", color: "#6366f1" },
} satisfies ChartConfig;

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
