"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { classificationSource, composeLetterNumber, getLetterClassification, searchLetterClassifications, splitLetterNumber } from "@/lib/letter-classification";

export function LetterNumberField({ id = "nomorSurat", label = "Nomor surat", value, onChange, defaultCode = "", placeholder = "123-Sekre", disabled = false, error }: {
  id?: string; label?: string; value: string; onChange: (value: string) => void;
  defaultCode?: string; placeholder?: string; disabled?: boolean; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const parts = splitLetterNumber(value);
  const code = parts.code || defaultCode;
  const selected = getLetterClassification(code);
  const suggested = getLetterClassification(defaultCode);
  const matches = useMemo(() => searchLetterClassifications(query), [query]);
  const displayed = !query.trim() && selected ? [selected, ...matches.filter((entry) => entry.code !== selected.code)] : matches;

  return <div className="min-w-0 space-y-3">
    <div className="grid gap-4 md:grid-cols-2">
      <div className="min-w-0 space-y-2"><Label htmlFor={`${id}-classification`}>Kode klasifikasi <span className="text-destructive">*</span></Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button id={`${id}-classification`} type="button" variant="outline" role="combobox" aria-expanded={open} aria-invalid={Boolean(error)} disabled={disabled} className="h-10 w-full justify-between overflow-hidden font-normal" />}>
            <span className="truncate">{selected ? `${selected.code} — ${selected.label}` : "Pilih kode sesuai isi surat"}</span><ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(90vw,42rem)] p-0"><Command shouldFilter={false}>
            <CommandInput placeholder="Cari kode atau uraian klasifikasi..." value={query} onValueChange={setQuery} />
            <CommandList><CommandEmpty>Kode klasifikasi tidak ditemukan.</CommandEmpty><CommandGroup>
              {displayed.slice(0, 75).map((entry) => <CommandItem key={entry.code} value={entry.code} onSelect={() => { onChange(composeLetterNumber(entry.code, parts.body)); setQuery(""); setOpen(false); }}>
                <Check className={`size-4 shrink-0 ${code === entry.code ? "opacity-100" : "opacity-0"}`} />
                <span className="min-w-0"><span className="block font-medium">{entry.code} — {entry.label}</span><span className="block text-xs text-zinc-500">{entry.path || "Kelompok utama"} · hal. {entry.page}</span></span>
              </CommandItem>)}
            </CommandGroup></CommandList><p className="border-t px-3 py-2 text-xs text-zinc-500">{Math.min(75, matches.length)} dari {matches.length} hasil. Ketik untuk mempersempit pencarian.</p>
          </Command></PopoverContent>
        </Popover>
        {suggested && <p className="text-xs leading-5 text-emerald-800">Saran sesuai dokumen: <button type="button" disabled={disabled} className="font-medium underline underline-offset-2" onClick={() => onChange(composeLetterNumber(suggested.code, parts.body))}>{suggested.code} — {suggested.label}</button></p>}
      </div>
      <div className="space-y-2"><Label htmlFor={`${id}-body`}>Nomor urut dan kode unit/tahun <span className="text-destructive">*</span></Label><Input id={`${id}-body`} value={parts.body} onChange={(event) => onChange(composeLetterNumber(code, event.target.value))} placeholder={placeholder} maxLength={100} disabled={disabled} aria-invalid={Boolean(error)} className="h-10" /><p className="text-xs text-zinc-500">Isi bagian setelah kode klasifikasi, misalnya {placeholder}.</p></div>
    </div>
    <div className="space-y-2"><Label htmlFor={id}>{label} lengkap</Label><Input id={id} value={value ? composeLetterNumber(code, parts.body) : ""} placeholder="Terisi setelah kode dan nomor dipilih" readOnly className="h-10 bg-zinc-50 font-medium" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} /></div>
    {selected && <p className="text-xs leading-5 text-zinc-500">{selected.path}{selected.path && " › "}{selected.label}. <a href={`${classificationSource.url}#page=${selected.page}`} target="_blank" rel="noreferrer" className="underline">Lihat dasar klasifikasi, halaman {selected.page}</a>.</p>}
    {error && <p id={`${id}-error`} className="text-xs font-medium text-destructive" role="alert">{error}</p>}
  </div>;
}
