"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Download, FilePenLine, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { formatIndonesianDate } from "@/lib/kgb";
import type { SuratLupaAbsenEmployee } from "@/lib/surat-lupa-absen-pulang";

type Values = { employeeNip: string; absenceDate: string; letterDate: string; reason: string; supervisorNip: string };

function EmployeeSelect({ id, label, employees, value, onChange, disabled, error }: {
  id: string; label: string; employees: SuratLupaAbsenEmployee[]; value: string;
  onChange: (nip: string) => void; disabled: boolean; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = employees.find((employee) => employee.nip === value);
  return <div className="space-y-2">
    <Label htmlFor={id}>{label}<span className="ml-1 text-destructive" aria-hidden="true">*</span></Label>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} aria-invalid={Boolean(error)} disabled={disabled} className="h-11 w-full justify-between overflow-hidden px-3 font-normal" />}>
        <span className={`truncate text-left ${!selected ? "text-muted-foreground" : ""}`}>{selected ? `${selected.name} · ${selected.nip}` : "Pilih pegawai"}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
        <Command>
          <CommandInput placeholder="Cari nama, NIP, atau jabatan..." />
          <CommandList>
            <CommandEmpty>Pegawai tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {employees.map((employee) => {
                const searchable = `${employee.name} ${employee.nip} ${employee.position} ${employee.unit ?? ""}`;
                return <CommandItem key={employee.nip} value={searchable} onSelect={() => { onChange(employee.nip); setOpen(false); }}>
                  <Check className={`size-4 shrink-0 ${employee.nip === value ? "opacity-100" : "opacity-0"}`} />
                  <span className="min-w-0"><span className="block truncate font-medium">{employee.name}</span><span className="block truncate text-xs text-zinc-500">{employee.nip} · {employee.position}</span></span>
                </CommandItem>;
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    {error && <p className="text-xs font-medium text-destructive" role="alert">{error}</p>}
  </div>;
}

export function SuratLupaAbsenPulangForm({ employees, today }: { employees: SuratLupaAbsenEmployee[]; today: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ employeeNip: "", absenceDate: today, letterDate: today, reason: "", supervisorNip: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  function setValue(key: keyof Values, value: string) {
    setValues((current) => ({ ...current, [key]: value, ...(key === "employeeNip" && current.supervisorNip === value ? { supervisorNip: "" } : {}) }));
    setErrors((current) => ({ ...current, [key]: [] }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      const response = await fetch("/api/surat-lupa-absen-pulang/generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Surat gagal dibuat." }));
        setErrors(payload.errors ?? {});
        throw new Error(payload.message ?? "Surat gagal dibuat.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Surat-Lupa-Absen-Pulang-${values.letterDate}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Surat berhasil dibuat, diunduh, dan disimpan ke arsip.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Surat gagal dibuat.");
    } finally {
      setSubmitting(false);
    }
  }

  const dateInput = (key: "absenceDate" | "letterDate") => ({
    type: "date" as const, value: values[key], disabled: submitting,
    "aria-invalid": Boolean(errors[key]?.length), className: "h-11",
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValue(key, event.target.value),
  });
  const selectedEmployee = employees.find((employee) => employee.nip === values.employeeNip);
  const supervisors = employees.filter((employee) => employee.nip !== selectedEmployee?.nip);

  return <form onSubmit={submit} className="space-y-6" noValidate>
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2"><FilePenLine className="size-5 text-indigo-600" />Data surat</CardTitle>
        <CardDescription>Template surat membutuhkan data pegawai, alasan tidak melakukan presensi pulang, dan atasan yang mengetahui.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <EmployeeSelect id="employeeNip" label="Pegawai yang lupa absen" employees={employees} value={values.employeeNip} onChange={(value) => setValue("employeeNip", value)} disabled={submitting} error={errors.employeeNip?.[0]} />
        <EmployeeSelect id="supervisorNip" label="Atasan yang mengetahui" employees={supervisors} value={values.supervisorNip} onChange={(value) => setValue("supervisorNip", value)} disabled={submitting || !selectedEmployee} error={errors.supervisorNip?.[0]} />
        <div className="space-y-2">
          <Label htmlFor="absenceDate">Tanggal lupa absen pulang<span className="ml-1 text-destructive" aria-hidden="true">*</span></Label>
          <Input id="absenceDate" {...dateInput("absenceDate")} />
          {errors.absenceDate?.[0] && <p className="text-xs font-medium text-destructive" role="alert">{errors.absenceDate[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="letterDate">Tanggal surat<span className="ml-1 text-destructive" aria-hidden="true">*</span></Label>
          <Input id="letterDate" {...dateInput("letterDate")} />
          {errors.letterDate?.[0] && <p className="text-xs font-medium text-destructive" role="alert">{errors.letterDate[0]}</p>}
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="reason">Alasan tidak melakukan presensi pulang<span className="ml-1 text-destructive" aria-hidden="true">*</span></Label>
          <Textarea id="reason" value={values.reason} onChange={(event) => setValue("reason", event.target.value)} disabled={submitting} aria-invalid={Boolean(errors.reason?.length)} maxLength={250} rows={3} placeholder="Tuliskan alasan singkat dalam satu baris" />
          <div className="flex justify-between gap-3 text-xs">
            {errors.reason?.[0] ? <p className="font-medium text-destructive" role="alert">{errors.reason[0]}</p> : <p className="text-zinc-500">Maksimal 250 karakter; alasan akan mengisi kolom pada template.</p>}
            <span className="shrink-0 text-zinc-500">{values.reason.length}/250</span>
          </div>
        </div>
      </CardContent>
    </Card>
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-950"><ShieldCheck className="size-4" />Tata letak template resmi dipertahankan</p>
          <p className="mt-1 text-xs leading-5 text-emerald-800">Tanggal surat ditulis sebagai {formatIndonesianDate(values.letterDate) || "tanggal Indonesia"}. Data identitas diambil dari daftar pegawai aktif.</p>
        </div>
        <Button type="submit" size="lg" disabled={submitting || employees.length === 0} className="min-w-56">
          {submitting ? <><LoaderCircle className="animate-spin" />Membuat dokumen...</> : <><Download />Buat dan unduh DOCX</>}
        </Button>
      </CardContent>
    </Card>
  </form>;
}
