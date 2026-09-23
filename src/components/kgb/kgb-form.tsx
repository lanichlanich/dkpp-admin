"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Download, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  addYearsToDate,
  birthDateFromNip,
  formatIndonesianDate,
  formatRupiah,
  salaryForRankAndYears,
  terbilangRupiah,
  type KgbEmployee,
} from "@/lib/kgb";
import { cn } from "@/lib/utils";

type FormValues = {
  nomorSurat: string;
  tglSurat: string;
  nip: string;
  gajiLama: string;
  pejabatKgbLama: string;
  nomorKgbLama: string;
  tglKgbLama: string;
  tmtKgbLama: string;
  mkgTahunLama: string;
  mkgBulanLama: string;
  mkgTahunBaru: string;
  mkgBulanBaru: string;
  tmtKgbBaru: string;
};

const initialValues: FormValues = {
  nomorSurat: "", tglSurat: "", nip: "", gajiLama: "", pejabatKgbLama: "",
  nomorKgbLama: "", tglKgbLama: "", tmtKgbLama: "", mkgTahunLama: "0",
  mkgBulanLama: "0", mkgTahunBaru: "0", mkgBulanBaru: "0", tmtKgbBaru: "",
};

const yearOptions = Array.from({ length: 33 }, (_, index) => index);
const monthOptions = Array.from({ length: 13 }, (_, index) => index);
const officialSuggestions = [
  "KEPALA DKPP Kab.Indramayu",
  "Plt. KEPALA DKPP Kab.Indramayu",
  "BUPATI INDRAMAYU",
];

function Field({
  id,
  label,
  description,
  error,
  required = true,
  children,
}: {
  id: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="gap-1">
        {label}{required && <span className="text-destructive" aria-hidden="true">*</span>}
      </Label>
      {children}
      {description && !error && <p className="text-xs leading-5 text-zinc-500">{description}</p>}
      {error && <p className="text-xs font-medium text-destructive" role="alert">{error}</p>}
    </div>
  );
}

function ReadOnlyField({ id, label, value, placeholder = "Terisi otomatis" }: { id: string; label: string; value: string; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} readOnly disabled className="h-10 disabled:opacity-70" />
    </div>
  );
}

function NumberSelect({ id, value, values, disabled, onChange }: { id: string; value: string; values: number[]; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50">
      {values.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  );
}

function EmployeeSelect({ employees, value, disabled, invalid, onChange }: { employees: KgbEmployee[]; value: string; disabled: boolean; invalid: boolean; onChange: (nip: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = employees.find((employee) => employee.nip === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button id="nip" type="button" variant="outline" role="combobox" aria-expanded={open} aria-invalid={invalid} disabled={disabled} className="h-10 w-full justify-between overflow-hidden px-3 font-normal" />}>
        <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>{selected ? `${selected.name} — ${selected.nip}` : "Pilih pegawai PNS aktif"}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
        <Command>
          <CommandInput placeholder="Cari nama atau NIP..." />
          <CommandList>
            <CommandEmpty>Pegawai PNS aktif tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {employees.map((employee) => (
                <CommandItem key={employee.nip} value={`${employee.name} ${employee.nip} ${employee.rank}`} onSelect={() => { onChange(employee.nip); setOpen(false); }}>
                  <Check className={cn("size-4", value === employee.nip ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0"><span className="block truncate">{employee.name}</span><span className="block truncate text-xs text-muted-foreground">{employee.nip} · {employee.rank}</span></span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function KgbForm({ employees }: { employees: KgbEmployee[] }) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const employee = useMemo(() => employees.find((item) => item.nip === values.nip), [employees, values.nip]);
  const gajiLama = Number(values.gajiLama);
  const gajiBaru = employee ? salaryForRankAndYears(employee.rank, Number(values.mkgTahunBaru)) : null;
  const tmtDepan = values.mkgTahunBaru === "32" ? "" : addYearsToDate(values.tmtKgbBaru, 2);

  const setValue = (key: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: [] }));
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    toast.info("Dokumen sedang disusun...");
    try {
      const response = await fetch("/api/kgb/generate", {
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
      anchor.download = `SK-KGB-${values.nip}-${values.tglSurat}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("SK KGB berhasil dibuat dan diunduh.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokumen gagal dibuat.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputProps = (key: keyof FormValues) => ({
    disabled: submitting,
    "aria-invalid": Boolean(errors[key]?.length),
    className: "h-10",
  });

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Data surat dan pegawai</CardTitle>
          <CardDescription>Nomor surat diisi angka saja; prefiks dan sufiks sudah tersedia pada template.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field id="nomorSurat" label="Nomor surat" error={errors.nomorSurat?.[0]} description="Contoh: 123 untuk menghasilkan 800.1.11.13/123-Sekre.">
            <Input id="nomorSurat" name="nomorSurat" type="number" min="0" value={values.nomorSurat} onChange={(e) => setValue("nomorSurat", e.target.value)} {...inputProps("nomorSurat")} />
          </Field>
          <Field id="tglSurat" label="Tanggal surat" error={errors.tglSurat?.[0]}>
            <Input id="tglSurat" type="date" value={values.tglSurat} onChange={(e) => setValue("tglSurat", e.target.value)} {...inputProps("tglSurat")} />
          </Field>
          <div className="md:col-span-2">
            <Field id="nip" label="Nama pegawai" error={errors.nip?.[0]} description="Hanya pegawai PNS dengan status Aktif yang ditampilkan.">
              <EmployeeSelect employees={employees} value={values.nip} disabled={submitting} invalid={Boolean(errors.nip?.length)} onChange={(value) => setValue("nip", value)} />
            </Field>
          </div>
          <ReadOnlyField id="nipOtomatis" label="NIP" value={employee?.nip ?? ""} />
          <ReadOnlyField id="tanggalLahirOtomatis" label="Tanggal lahir" value={employee ? birthDateFromNip(employee.nip) : ""} />
          <div className="md:col-span-2"><ReadOnlyField id="pangkatGolonganOtomatis" label="Pangkat / golongan" value={employee?.rank ?? ""} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b"><CardTitle>Dasar KGB lama</CardTitle><CardDescription>Data keputusan yang menjadi dasar kenaikan gaji berkala berikutnya.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field id="gajiLama" label="Gaji lama" error={errors.gajiLama?.[0]} description={gajiLama > 0 ? `${formatRupiah(gajiLama)} — ${terbilangRupiah(gajiLama)}` : "Masukkan nominal tanpa tanda titik atau koma."}>
            <Input id="gajiLama" type="number" min="1" step="1" value={values.gajiLama} onChange={(e) => setValue("gajiLama", e.target.value)} {...inputProps("gajiLama")} />
          </Field>
          <Field id="pejabatKgbLama" label="Pejabat penandatangan" error={errors.pejabatKgbLama?.[0]} description="Pilih saran atau ketik jabatan lain.">
            <Input id="pejabatKgbLama" list="pejabat-kgb-options" value={values.pejabatKgbLama} onChange={(e) => setValue("pejabatKgbLama", e.target.value)} {...inputProps("pejabatKgbLama")} />
            <datalist id="pejabat-kgb-options">{officialSuggestions.map((option) => <option key={option} value={option} />)}</datalist>
          </Field>
          <Field id="nomorKgbLama" label="Nomor SK KGB lama" error={errors.nomorKgbLama?.[0]} description="Kolom ini ditambahkan untuk memperbaiki tag Nomor yang terduplikasi pada template.">
            <Input id="nomorKgbLama" value={values.nomorKgbLama} onChange={(e) => setValue("nomorKgbLama", e.target.value)} {...inputProps("nomorKgbLama")} />
          </Field>
          <Field id="tglKgbLama" label="Tanggal SK KGB lama" error={errors.tglKgbLama?.[0]}>
            <Input id="tglKgbLama" type="date" value={values.tglKgbLama} onChange={(e) => setValue("tglKgbLama", e.target.value)} {...inputProps("tglKgbLama")} />
          </Field>
          <Field id="tmtKgbLama" label="TMT KGB lama" error={errors.tmtKgbLama?.[0]}>
            <Input id="tmtKgbLama" type="date" value={values.tmtKgbLama} onChange={(e) => setValue("tmtKgbLama", e.target.value)} {...inputProps("tmtKgbLama")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="mkgTahunLama" label="MKG tahun lama" error={errors.mkgTahunLama?.[0]}><NumberSelect id="mkgTahunLama" value={values.mkgTahunLama} values={yearOptions} disabled={submitting} onChange={(value) => setValue("mkgTahunLama", value)} /></Field>
            <Field id="mkgBulanLama" label="MKG bulan lama" error={errors.mkgBulanLama?.[0]}><NumberSelect id="mkgBulanLama" value={values.mkgBulanLama} values={monthOptions} disabled={submitting} onChange={(value) => setValue("mkgBulanLama", value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b"><CardTitle>KGB baru</CardTitle><CardDescription>Nominal dihitung otomatis dari tabel gaji pokok PNS tahun 2024.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-4 md:col-span-2">
            <Field id="mkgTahunBaru" label="MKG tahun baru" error={errors.mkgTahunBaru?.[0]}><NumberSelect id="mkgTahunBaru" value={values.mkgTahunBaru} values={yearOptions} disabled={submitting} onChange={(value) => setValue("mkgTahunBaru", value)} /></Field>
            <Field id="mkgBulanBaru" label="MKG bulan baru" error={errors.mkgBulanBaru?.[0]}><NumberSelect id="mkgBulanBaru" value={values.mkgBulanBaru} values={monthOptions} disabled={submitting} onChange={(value) => setValue("mkgBulanBaru", value)} /></Field>
          </div>
          <ReadOnlyField id="gajiBaruOtomatis" label="Gaji baru" value={gajiBaru === null ? "" : formatRupiah(gajiBaru)} placeholder={employee ? "MKG tidak tersedia untuk golongan ini" : "Pilih pegawai dan MKG"} />
          <ReadOnlyField id="terbilangGajiBaruOtomatis" label="Terbilang gaji baru" value={gajiBaru === null ? "" : terbilangRupiah(gajiBaru)} />
          <Field id="tmtKgbBaru" label="TMT KGB baru" error={errors.tmtKgbBaru?.[0]}>
            <Input id="tmtKgbBaru" type="date" value={values.tmtKgbBaru} onChange={(e) => setValue("tmtKgbBaru", e.target.value)} {...inputProps("tmtKgbBaru")} />
          </Field>
          <ReadOnlyField id="tmtKgbBerikutnyaOtomatis" label="TMT KGB berikutnya" value={tmtDepan ? formatIndonesianDate(tmtDepan) : ""} placeholder={values.mkgTahunBaru === "32" ? "Dikosongkan karena MKG sudah 32 tahun" : "Terisi otomatis 2 tahun setelah TMT baru"} />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-xl border bg-white/95 p-4 shadow-lg backdrop-blur">
        <p className="hidden text-xs leading-5 text-zinc-500 sm:block">Semua kolom bertanda <span className="text-destructive">*</span> wajib diisi.</p>
        <Button type="submit" size="lg" disabled={submitting || employees.length === 0} className="ml-auto min-w-44">
          {submitting ? <><LoaderCircle className="animate-spin" />Membuat dokumen...</> : <><Download />Buat dan unduh DOCX</>}
        </Button>
      </div>
    </form>
  );
}
