"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function SearchableSelect({
  name,
  options,
  defaultValue = "",
  placeholder = "Pilih opsi",
  searchPlaceholder = "Cari...",
  disabled = false,
  invalid = false,
}: {
  name: string;
  options: string[];
  defaultValue?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button id={name} type="button" variant="outline" role="combobox" aria-expanded={open} aria-invalid={invalid} disabled={disabled} className="h-11 w-full justify-between overflow-hidden px-3 font-normal" />}>
          <span className={cn("truncate text-left", !value && "text-muted-foreground")}>{value || placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>Data tidak ditemukan.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem key={option} value={option} onSelect={() => { setValue(option); setOpen(false); }}>
                    <Check className={cn("size-4", value === option ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{option}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
