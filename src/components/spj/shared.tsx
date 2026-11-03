"use client";
import { useId, useState } from "react";
import { ChevronsUpDown, Download } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { SpjEmployee } from "@/lib/spj-types";
import { cn } from "@/lib/utils";

export const spjSelectClass = "h-10 w-full min-w-0 rounded-lg border border-input bg-white px-3 text-sm";
export const spjActionClass = {
  primary: "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white focus-visible:border-emerald-600 focus-visible:ring-emerald-600/30",
  edit: "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 hover:text-amber-950 focus-visible:border-amber-500 focus-visible:ring-amber-500/30",
  remove: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 focus-visible:border-rose-500 focus-visible:ring-rose-500/30",
  search: "border-blue-700 bg-blue-700 text-white hover:bg-blue-800 hover:text-white focus-visible:border-blue-600 focus-visible:ring-blue-600/30",
  attendance: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 focus-visible:border-blue-500 focus-visible:ring-blue-500/30",
  receipt: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800 focus-visible:border-violet-500 focus-visible:ring-violet-500/30",
} as const;
export const spjMoney = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
export async function spjRequest(path: string, method: string, input: unknown) {
  const response = await fetch(`/api/spj-pelayanan-umum/${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Proses SPJ gagal. Silakan coba lagi.");
  return data.result as { id: string };
}
export function SpjDownloads({ id }: { id: string }) {
  return <div className="flex flex-wrap gap-2">{[["attendance", "Daftar hadir PDF", spjActionClass.attendance], ["receipt", "Daftar penerimaan PDF", spjActionClass.receipt]].map(([kind, label, color]) =>
    <a key={kind} href={`/api/spj-pelayanan-umum/reports/${id}/download?kind=${kind}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), color)}><Download aria-hidden="true" className="size-4" />{label}</a>)}</div>;
}
export function SpjEmployeePicker({ label, employees, value, onChange, disabled }: { label: string; employees: SpjEmployee[]; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId(), [open, setOpen] = useState(false), selected = employees.find(e => e.nip === value);
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button id={id} type="button" variant="outline" role="combobox" aria-label={label} aria-required="true" aria-expanded={open} disabled={disabled} className="h-auto min-h-10 w-full justify-between whitespace-normal text-left font-normal" />}><span>{selected?.name || "Pilih pegawai"}</span><ChevronsUpDown aria-hidden="true" className="ml-2 size-4 shrink-0" /></PopoverTrigger>
    <PopoverContent align="start" className="w-[min(34rem,calc(100vw-3rem))] p-0"><Command><CommandInput aria-label={`Cari ${label}`} placeholder="Cari nama, NIP, atau jabatan…" /><CommandList><CommandEmpty>Pegawai tidak ditemukan.</CommandEmpty><CommandGroup>{employees.map(e => <CommandItem key={e.nip} value={`${e.name} ${e.nip} ${e.position}`} onSelect={() => { onChange(e.nip); setOpen(false); }}><span><span className="block">{e.name}</span><span className="block text-xs text-zinc-500">{e.nip} · {e.position}</span></span></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent>
  </Popover>{selected && <p className="text-xs text-zinc-500">NIP. {selected.nip}</p>}</div>;
}
