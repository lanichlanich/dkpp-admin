"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Download, FileCheck2, Gavel, LoaderCircle, Scale, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DpcpEmployeeOption } from "@/lib/employees";
import { formatIndonesianDate } from "@/lib/kgb";
import type { OfficialStatementType } from "@/lib/official-statement-validation";
import { cn } from "@/lib/utils";

type FormValues = {
  documentType: OfficialStatementType;
  nip: string;
  nomorSurat: string;
  tanggalSurat: string;
};

function Field({ id, label, description, error, children }: {
  id: string;
  label: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="gap-1">{label}<span className="text-destructive" aria-hidden="true">*</span></Label>
      {children}
      {description && !error && <p className="text-xs leading-5 text-zinc-500">{description}</p>}
      {error && <p className="text-xs font-medium text-destructive" role="alert">{error}</p>}
    </div>
  );
}

function ReadOnlyField({ id, label, value }: { id: string; label: string; value: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} placeholder="Terisi otomatis" readOnly disabled className="h-10 disabled:opacity-70" /></div>;
}

function EmployeeSelect({ employees, value, disabled, invalid, onChange }: {
  employees: DpcpEmployeeOption[];
  value: string;
  disabled: boolean;
  invalid: boolean;
  onChange: (nip: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = employees.find((employee) => employee.nip === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button id="nip" type="button" variant="outline" role="combobox" aria-expanded={open} aria-invalid={invalid} disabled={disabled} className="h-11 w-full justify-between overflow-hidden px-3 font-normal" />}>
        <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>{selected ? `${selected.name} — ${selected.nip}` : "Pilih pegawai PNS aktif"}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
        <Command>
          <CommandInput placeholder="Cari nama atau NIP..." />
          <CommandList><CommandEmpty>Pegawai PNS aktif tidak ditemukan.</CommandEmpty><CommandGroup>
            {employees.map((employee) => (
              <CommandItem key={employee.nip} value={`${employee.name} ${employee.nip} ${employee.rank} ${employee.position}`} onSelect={() => { onChange(employee.nip); setOpen(false); }}>
                <Check className={cn("size-4", value === employee.nip ? "opacity-100" : "opacity-0")} />
                <span className="min-w-0"><span className="block truncate">{employee.name}</span><span className="block truncate text-xs text-muted-foreground">{employee.nip} · {employee.rank}</span></span>
              </CommandItem>
            ))}
          </CommandGroup></CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const statementOptions: Array<{
  value: OfficialStatementType;
  title: string;
  description: string;
  icon: typeof Scale;
}> = [
  {
    value: "hukdis",
    title: "Surat HUKDIS",
    description: "Pernyataan tidak pernah dijatuhi hukuman disiplin tingkat sedang atau berat.",
    icon: Scale,
  },
  {
    value: "hukda",
    title: "Surat HUKDA",
    description: "Pernyataan tidak sedang menjalani proses pidana atau pernah dipidana.",
    icon: Gavel,
  },
];

export function OfficialStatementForm({ employees, today }: { employees: DpcpEmployeeOption[]; today: string }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({ documentType: "hukdis", nip: "", nomorSurat: "", tanggalSurat: today });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const employee = useMemo(() => employees.find((item) => item.nip === values.nip), [employees, values.nip]);
  const selectedType = statementOptions.find((option) => option.value === values.documentType)!;

  function setValue<Key extends keyof FormValues>(key: Key, value: FormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: [] }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    toast.info(`${selectedType.title} sedang disusun...`);
    try {
      const response = await fetch("/api/surat-hukdis-hukda/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Dokumen gagal dibuat." }));
        setErrors(payload.errors ?? {});
        throw new Error(payload.message ?? "Dokumen gagal dibuat.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Surat-${values.documentType.toUpperCase()}-${values.nip}-${values.tanggalSurat}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(`${selectedType.title} berhasil dibuat, diunduh, dan disimpan ke arsip.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokumen gagal dibuat.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2"><FileCheck2 className="size-5 text-indigo-600" />Pilih jenis surat</CardTitle>
          <CardDescription>Pilih format pernyataan resmi yang akan dibuat.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {statementOptions.map((option) => {
            const Icon = option.icon;
            const selected = values.documentType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                disabled={submitting}
                onClick={() => setValue("documentType", option.value)}
                className={cn(
                  "flex min-h-28 items-start gap-4 rounded-xl border p-4 text-left outline-none transition hover:border-indigo-200 hover:bg-indigo-50/40 focus-visible:ring-2 focus-visible:ring-indigo-500",
                  selected && "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200",
                )}
              >
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600", selected && "bg-indigo-600 text-white")}><Icon className="size-4" /></span>
                <span><span className="block font-semibold text-zinc-900">{option.title}</span><span className="mt-1 block text-xs leading-5 text-zinc-500">{option.description}</span></span>
              </button>
            );
          })}
          {errors.documentType?.[0] && <p className="text-xs font-medium text-destructive md:col-span-2" role="alert">{errors.documentType[0]}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Identitas pegawai</CardTitle>
          <CardDescription>Pilih PNS aktif. Nama, NIP, pangkat/golongan, dan jabatan diisi otomatis dari data pegawai.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field id="nip" label="Nama pegawai" error={errors.nip?.[0]} description="Daftar hanya memuat PNS berstatus Aktif.">
              <EmployeeSelect employees={employees} value={values.nip} disabled={submitting} invalid={Boolean(errors.nip?.length)} onChange={(nip) => setValue("nip", nip)} />
            </Field>
          </div>
          <ReadOnlyField id="nipOtomatis" label="NIP" value={employee?.nip ?? ""} />
          <ReadOnlyField id="pangkatOtomatis" label="Pangkat / golongan" value={employee?.rank ?? ""} />
          <div className="md:col-span-2"><ReadOnlyField id="jabatanOtomatis" label="Jabatan" value={employee?.position ?? ""} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b"><CardTitle>Nomor dan tanggal surat</CardTitle><CardDescription>Kedua kolom ini mengganti tag pada template Word.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field id="nomorSurat" label="Nomor surat" error={errors.nomorSurat?.[0]} description="Masukkan nomor lengkap sesuai penomoran naskah dinas.">
            <Input id="nomorSurat" value={values.nomorSurat} onChange={(event) => setValue("nomorSurat", event.target.value)} disabled={submitting} aria-invalid={Boolean(errors.nomorSurat?.length)} className="h-10" placeholder="Contoh: 800.1.11.1/123/DKPP" />
          </Field>
          <Field id="tanggalSurat" label="Tanggal surat" error={errors.tanggalSurat?.[0]} description={values.tanggalSurat ? `Ditampilkan sebagai ${formatIndonesianDate(values.tanggalSurat)}.` : undefined}>
            <Input id="tanggalSurat" type="date" value={values.tanggalSurat} onChange={(event) => setValue("tanggalSurat", event.target.value)} disabled={submitting} aria-invalid={Boolean(errors.tanggalSurat?.length)} className="h-10" />
          </Field>
        </CardContent>
      </Card>

      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-950"><ShieldCheck className="size-4" />Format resmi dan penanda TTE dipertahankan</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">Kop, isi pernyataan, identitas pejabat penandatangan, tabel, dan tata letak mengikuti template terlampir.</p>
          </div>
          <Button type="submit" size="lg" disabled={submitting || employees.length === 0} className="min-w-56">
            {submitting ? <><LoaderCircle className="animate-spin" />Membuat dokumen...</> : <><Download />Buat dan unduh DOCX</>}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
