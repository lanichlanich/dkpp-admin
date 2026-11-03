"use client";
import { useId, useState } from "react";
import { ChevronsUpDown, Download } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { SpjEmployee } from "@/lib/spj-types";

export const spjSelectClass = "h-10 w-full min-w-0 rounded-lg border border-input bg-white px-3 text-sm";
export const spjMoney = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
export async function spjRequest(path: string, method: string, input: unknown) {
  const response = await fetch(`/api/spj-pelayanan-umum/${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Proses SPJ gagal. Silakan coba lagi.");
  return data.result as { id: string };
}
export function SpjDownloads({ id }: { id: string }) {
  return <div className="flex flex-wrap gap-2">{[["attendance", "Daftar hadir PDF"], ["receipt", "Daftar penerimaan PDF"]].map(([kind, label]) =>
    <a key={kind} href={`/api/spj-pelayanan-umum/reports/${id}/download?kind=${kind}`} className={buttonVariants({ variant: "outline", size: "sm" })}><Download aria-hidden="true" className="size-4" />{label}</a>)}</div>;
}
export function SpjEmployeePicker({ label, employees, value, onChange, disabled }: { label: string; employees: SpjEmployee[]; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId(), [open, setOpen] = useState(false), selected = employees.find(e => e.nip === value);
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button id={id} type="button" variant="outline" role="combobox" aria-label={label} aria-required="true" aria-expanded={open} disabled={disabled} className="h-auto min-h-10 w-full justify-between whitespace-normal text-left font-normal" />}><span>{selected?.name || "Pilih pegawai"}</span><ChevronsUpDown aria-hidden="true" className="ml-2 size-4 shrink-0" /></PopoverTrigger>
    <PopoverContent align="start" className="w-[min(34rem,calc(100vw-3rem))] p-0"><Command><CommandInput aria-label={`Cari ${label}`} placeholder="Cari nama, NIP, atau jabatan…" /><CommandList><CommandEmpty>Pegawai tidak ditemukan.</CommandEmpty><CommandGroup>{employees.map(e => <CommandItem key={e.nip} value={`${e.name} ${e.nip} ${e.position}`} onSelect={() => { onChange(e.nip); setOpen(false); }}><span><span className="block">{e.name}</span><span className="block text-xs text-zinc-500">{e.nip} · {e.position}</span></span></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent>
  </Popover>{selected && <p className="text-xs text-zinc-500">NIP. {selected.nip}</p>}</div>;
}
