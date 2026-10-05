"use client";
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { signatoryTitle, type Signatory, type SignatoryOption } from "@/lib/signatory";

export function SignatoryField({ value, onChange, options, disabled, error }: {
  value: Signatory; onChange: (value: Signatory) => void; options: SignatoryOption[]; disabled?: boolean; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof Signatory>(key: K, next: Signatory[K]) => onChange({ ...value, [key]: next });
  return <Card><CardHeader><CardTitle>Pejabat penandatangan</CardTitle><CardDescription>Pilih pejabat, periksa identitas dan jabatan, lalu tentukan status penandatangan untuk dokumen ini.</CardDescription></CardHeader>
    <CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="signatory-select">Pilih pejabat</Label><Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button id="signatory-select" type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="h-10 w-full justify-between overflow-hidden font-normal" />}><span className="truncate">{value.name || "Pilih pejabat"}</span><ChevronsUpDown className="size-4 shrink-0" /></PopoverTrigger>
        <PopoverContent align="start" className="w-[min(90vw,38rem)] p-0"><Command><CommandInput placeholder="Cari nama, NIP, atau jabatan pejabat..." /><CommandList><CommandEmpty>Pejabat tidak ditemukan. Identitas dapat diisi manual.</CommandEmpty><CommandGroup>{options.map((option) => <CommandItem key={option.id} value={`${option.name} ${option.nip} ${option.title}`} onSelect={() => { onChange({ name: option.name, nip: option.nip, rank: option.rank, title: option.title, status: option.status }); setOpen(false); }}><Check className={`size-4 shrink-0 ${option.name === value.name ? "opacity-100" : "opacity-0"}`} /><span><span className="block">{option.name}</span><span className="block text-xs text-zinc-500">{signatoryTitle(option)}{option.nip && ` · ${option.nip}`}</span></span></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent>
      </Popover></div>
      <div className="space-y-2"><Label htmlFor="signatory-status">Status penandatangan</Label><select id="signatory-status" value={value.status} onChange={(event) => set("status", event.target.value as Signatory["status"])} disabled={disabled} className="h-10 w-full rounded-lg border bg-background px-3 text-sm"><option value="definitif">Definitif</option><option value="plt">Plt. (Pelaksana Tugas)</option></select></div>
      {([['name', 'Nama pejabat dan gelar'], ['title', 'Jabatan penandatangan'], ['nip', 'NIP pejabat (opsional)'], ['rank', 'Pangkat/golongan pejabat (opsional)']] as const).map(([key, label]) => <div key={key} className="space-y-2"><Label htmlFor={`signatory-${key}`}>{label}</Label><Input id={`signatory-${key}`} value={value[key]} onChange={(event) => set(key, key === "nip" ? event.target.value.replace(/\D/g, "") : event.target.value)} disabled={disabled} maxLength={key === "nip" ? 18 : key === "title" ? 180 : key === "rank" ? 100 : 160} /></div>)}
    </div><p className="text-sm font-medium text-emerald-800">{signatoryTitle(value)} — {value.name}</p><p className="text-xs text-zinc-500">NIP dan pangkat yang kosong tidak dicetak. Perubahan di sini hanya berlaku untuk dokumen yang dibuat.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</CardContent>
  </Card>;
}
