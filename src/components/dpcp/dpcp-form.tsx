"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Download, LoaderCircle, ScanText, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { DpcpEmployeeOption } from "@/lib/employees";
import { birthDateFromNip, formatIndonesianDate, formatRupiah } from "@/lib/kgb";
import type { LocalDocumentExtractionResult } from "@/lib/local-document-ai-types";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

type FormValues = {
  nip: string;
  bup: string;
  tempatLahir: string;
  gaji: string;
  mkg: string;
  mkp: string;
  mksp: string;
  pendidikan1: string;
  tmtpns: string;
  namaPasangan: string;
  tglPasangan: string;
  tglNikah: string;
  pasanganKe: string;
  namaAnak1: string;
  tglAnak1: string;
  statusAnak1: string;
  orangTuaAnak1: string;
  namaAnak2: string;
  tglAnak2: string;
  statusAnak2: string;
  orangTuaAnak2: string;
  alamatPensiun: string;
  tglDpcp: string;
};

function initialValues(today: string): FormValues {
  return {
    nip: "", bup: "", tempatLahir: "", gaji: "", mkg: "", mkp: "", mksp: "",
    pendidikan1: "", tmtpns: "", namaPasangan: "", tglPasangan: "", tglNikah: "",
    pasanganKe: "", namaAnak1: "", tglAnak1: "", statusAnak1: "", orangTuaAnak1: "",
    namaAnak2: "", tglAnak2: "", statusAnak2: "", orangTuaAnak2: "",
    alamatPensiun: "", tglDpcp: today,
  };
}

function Field({ id, label, error, description, required = true, children }: { id: string; label: string; error?: string; description?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="gap-1">{label}{required && <span className="text-destructive" aria-hidden="true">*</span>}</Label>
      {children}
      {description && !error && <p className="text-xs leading-5 text-zinc-500">{description}</p>}
      {error && <p className="text-xs font-medium text-destructive" role="alert">{error}</p>}
    </div>
  );
}

function ReadOnlyField({ id, label, value }: { id: string; label: string; value: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} placeholder="Terisi otomatis" readOnly disabled className="h-10 disabled:opacity-70" /></div>;
}

function EmployeeSelect({ employees, value, disabled, invalid, onChange }: { employees: DpcpEmployeeOption[]; value: string; disabled: boolean; invalid: boolean; onChange: (nip: string) => void }) {
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
          <CommandList><CommandEmpty>Pegawai PNS aktif tidak ditemukan.</CommandEmpty><CommandGroup>
            {employees.map((employee) => (
              <CommandItem key={employee.nip} value={`${employee.name} ${employee.nip} ${employee.rank}`} onSelect={() => { onChange(employee.nip); setOpen(false); }}>
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

export function DpcpForm({ employees, today }: { employees: DpcpEmployeeOption[]; today: string }) {
  const router = useRouter();
  const sourceFilesRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(() => initialValues(today));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<LocalDocumentExtractionResult | null>(null);
  const employee = useMemo(() => employees.find((item) => item.nip === values.nip), [employees, values.nip]);
  const busy = submitting || extracting;

  function setValue(key: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: [] }));
  }

  function changeEmployee(nip: string) {
    setValues({ ...initialValues(today), nip });
    setErrors({});
    setExtractionResult(null);
    if (sourceFilesRef.current) sourceFilesRef.current.value = "";
  }

  async function readAndFill() {
    if (!employee) {
      toast.error("Pilih pegawai terlebih dahulu agar identitas dokumen dapat dicocokkan.");
      return;
    }
    const files = Array.from(sourceFilesRef.current?.files ?? []);
    if (files.length === 0) {
      toast.error("Pilih minimal satu dokumen sumber.");
      return;
    }
    if (files.length > 5) {
      toast.error("Maksimal 5 dokumen dapat dibaca sekaligus.");
      return;
    }
    if (files.some((file) => file.size > MAX_UPLOAD_SIZE_BYTES)) {
      toast.error(`Ukuran setiap file maksimal ${MAX_UPLOAD_SIZE_MB} MB.`);
      return;
    }
    if (files.reduce((total, file) => total + file.size, 0) > MAX_UPLOAD_SIZE_BYTES) {
      toast.error(`Total ukuran dokumen maksimal ${MAX_UPLOAD_SIZE_MB} MB.`);
      return;
    }

    setExtracting(true);
    setExtractionResult(null);
    try {
      const request = new FormData();
      request.append("kind", "dpcp");
      request.append("employeeName", employee.name);
      request.append("employeeNip", employee.nip);
      files.forEach((file) => request.append("files", file));
      const response = await fetch("/api/document-ai/extract", { method: "POST", body: request });
      const payload = await response.json().catch(() => ({ message: "Dokumen gagal dibaca." })) as LocalDocumentExtractionResult & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Dokumen gagal dibaca.");

      const extractedValues = payload.values;
      const fillable = (Object.keys(initialValues(today)) as (keyof FormValues)[])
        .filter((key) => key !== "nip" && key !== "tglDpcp" && !values[key] && extractedValues[key]);
      setValues((current) => {
        const next = { ...current };
        for (const key of fillable) next[key] = extractedValues[key];
        return next;
      });
      setExtractionResult(payload);
      toast.success(`${fillable.length} kolom kosong berhasil diisi. Periksa hasilnya sebelum membuat DPCP.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokumen gagal dibaca.");
    } finally {
      setExtracting(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    toast.info("Dokumen DPCP sedang disusun...");
    try {
      const response = await fetch("/api/dpcp/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Dokumen DPCP gagal dibuat." }));
        setErrors(payload.errors ?? {});
        throw new Error(payload.message ?? "Dokumen DPCP gagal dibuat.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `DPCP-${values.nip}-${values.tglDpcp}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Dokumen DPCP berhasil dibuat dan diunduh.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokumen DPCP gagal dibuat.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputProps = (key: keyof FormValues) => ({
    disabled: busy,
    "aria-invalid": Boolean(errors[key]?.length),
    className: cn("h-10", extractionResult?.confidence[key] === "low" && values[key] && "border-amber-400 bg-amber-50"),
  });

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardHeader className="border-b border-emerald-100">
          <CardTitle className="flex items-center gap-2"><ScanText className="size-5 text-emerald-700" />Isi otomatis dari dokumen</CardTitle>
          <CardDescription>Dokumen dibaca menggunakan Google Gemini. Data yang sudah Anda isi tidak akan ditimpa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dpcp-source-files">Dokumen sumber</Label>
            <Input ref={sourceFilesRef} id="dpcp-source-files" type="file" multiple accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp" disabled={busy} className="cursor-pointer file:mr-3 file:font-medium" />
            <p className="text-xs leading-5 text-zinc-500">Maksimal 5 file, {MAX_UPLOAD_SIZE_MB} MB per file, dan total {MAX_UPLOAD_SIZE_MB} MB. Gunakan PDF/DOCX atau foto hasil scan yang jelas.</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs text-emerald-800"><ShieldCheck className="size-4" />Dokumen dikirim ke Google Gemini untuk mengisi draf yang perlu Anda periksa.</p>
            <Button type="button" variant="outline" onClick={readAndFill} disabled={busy || !employee}>
              {extracting ? <><LoaderCircle className="animate-spin" />Membaca dokumen...</> : <><ScanText />Baca & isi form</>}
            </Button>
          </div>
          {extractionResult && (
            <div className="rounded-lg border border-emerald-200 bg-white/80 p-3 text-xs leading-5 text-emerald-950">
              <p className="font-medium">Selesai diproses menggunakan Gemini: {extractionResult.model}.</p>
              <p>Kolom berwarna kuning memiliki keyakinan rendah dan wajib diperiksa.</p>
              {extractionResult.warnings.length > 0 && <ul className="mt-2 list-disc pl-5">{extractionResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b"><CardTitle>Data pegawai</CardTitle><CardDescription>Nama, NIP, jabatan, pangkat, golongan, tanggal lahir, dan Kepala Dinas diambil otomatis dari data pegawai aktif.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2"><Field id="nip" label="Nama pegawai" error={errors.nip?.[0]} description="Daftar hanya memuat pegawai PNS berstatus Aktif."><EmployeeSelect employees={employees} value={values.nip} disabled={busy} invalid={Boolean(errors.nip?.length)} onChange={changeEmployee} /></Field></div>
          <ReadOnlyField id="nipOtomatis" label="NIP" value={employee?.nip ?? ""} />
          <ReadOnlyField id="tanggalLahirOtomatis" label="Tanggal lahir" value={employee ? birthDateFromNip(employee.nip) : ""} />
          <div className="md:col-span-2"><ReadOnlyField id="jabatanOtomatis" label="Jabatan" value={employee?.position ?? ""} /></div>
          <div className="md:col-span-2"><ReadOnlyField id="pangkatOtomatis" label="Golongan / pangkat" value={employee?.rank ?? ""} /></div>
          <Field id="tempatLahir" label="Tempat lahir" error={errors.tempatLahir?.[0]} description="Tanggal lahir otomatis dibaca dari NIP."><Input id="tempatLahir" value={values.tempatLahir} onChange={(event) => setValue("tempatLahir", event.target.value)} {...inputProps("tempatLahir")} /></Field>
          <Field id="bup" label="Batas Usia Pensiun (BUP)" error={errors.bup?.[0]} description="Contoh: 58 Tahun atau 60 Tahun."><Input id="bup" value={values.bup} onChange={(event) => setValue("bup", event.target.value)} {...inputProps("bup")} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b"><CardTitle>Data kepegawaian tambahan</CardTitle><CardDescription>Isi data yang belum tersedia pada daftar pegawai.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field id="gaji" label="Gaji pokok terakhir" error={errors.gaji?.[0]} description={Number(values.gaji) > 0 ? formatRupiah(Number(values.gaji)) : "Masukkan nominal tanpa tanda titik atau koma."}><Input id="gaji" type="number" min="1" step="1" value={values.gaji} onChange={(event) => setValue("gaji", event.target.value)} {...inputProps("gaji")} /></Field>
          <Field id="pendidikan1" label="Pendidikan pertama" error={errors.pendidikan1?.[0]}><Input id="pendidikan1" value={values.pendidikan1} onChange={(event) => setValue("pendidikan1", event.target.value)} {...inputProps("pendidikan1")} /></Field>
          <Field id="mkg" label="Masa kerja golongan" error={errors.mkg?.[0]} description="Contoh: 28 Tahun 4 Bulan."><Input id="mkg" value={values.mkg} onChange={(event) => setValue("mkg", event.target.value)} {...inputProps("mkg")} /></Field>
          <Field id="mkp" label="Masa kerja pensiun" error={errors.mkp?.[0]} description="Contoh: 30 Tahun 2 Bulan."><Input id="mkp" value={values.mkp} onChange={(event) => setValue("mkp", event.target.value)} {...inputProps("mkp")} /></Field>
          <Field id="mksp" label="Masa kerja sebelum PNS" required={false} error={errors.mksp?.[0]} description="Kosongkan bila tidak ada; dokumen akan menampilkan tanda hubung."><Input id="mksp" value={values.mksp} onChange={(event) => setValue("mksp", event.target.value)} {...inputProps("mksp")} /></Field>
          <Field id="tmtpns" label="Mulai masuk PNS" error={errors.tmtpns?.[0]}><Input id="tmtpns" type="date" value={values.tmtpns} onChange={(event) => setValue("tmtpns", event.target.value)} {...inputProps("tmtpns")} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b"><CardTitle>Data keluarga</CardTitle><CardDescription>Bagian pasangan dan anak bersifat opsional. Kosongkan bila tidak ada.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <div><h3 className="mb-4 text-sm font-semibold text-zinc-900">Istri atau suami</h3><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <Field id="namaPasangan" label="Nama pasangan" required={false} error={errors.namaPasangan?.[0]}><Input id="namaPasangan" value={values.namaPasangan} onChange={(event) => setValue("namaPasangan", event.target.value)} {...inputProps("namaPasangan")} /></Field>
            <Field id="tglPasangan" label="Tanggal lahir" required={false} error={errors.tglPasangan?.[0]}><Input id="tglPasangan" type="date" value={values.tglPasangan} onChange={(event) => setValue("tglPasangan", event.target.value)} {...inputProps("tglPasangan")} /></Field>
            <Field id="tglNikah" label="Tanggal menikah" required={false} error={errors.tglNikah?.[0]}><Input id="tglNikah" type="date" value={values.tglNikah} onChange={(event) => setValue("tglNikah", event.target.value)} {...inputProps("tglNikah")} /></Field>
            <Field id="pasanganKe" label="Istri/suami ke" required={false} error={errors.pasanganKe?.[0]}><Input id="pasanganKe" value={values.pasanganKe} onChange={(event) => setValue("pasanganKe", event.target.value)} {...inputProps("pasanganKe")} /></Field>
          </div></div>
          {[1, 2].map((number) => {
            const nameKey = `namaAnak${number}` as "namaAnak1" | "namaAnak2";
            const dateKey = `tglAnak${number}` as "tglAnak1" | "tglAnak2";
            const statusKey = `statusAnak${number}` as "statusAnak1" | "statusAnak2";
            const parentKey = `orangTuaAnak${number}` as "orangTuaAnak1" | "orangTuaAnak2";
            return <div key={number} className="border-t pt-5"><h3 className="mb-4 text-sm font-semibold text-zinc-900">Anak {number}</h3><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <Field id={nameKey} label="Nama anak" required={false} error={errors[nameKey]?.[0]}><Input id={nameKey} value={values[nameKey]} onChange={(event) => setValue(nameKey, event.target.value)} {...inputProps(nameKey)} /></Field>
              <Field id={dateKey} label="Tanggal lahir" required={false} error={errors[dateKey]?.[0]}><Input id={dateKey} type="date" value={values[dateKey]} onChange={(event) => setValue(dateKey, event.target.value)} {...inputProps(dateKey)} /></Field>
              <Field id={statusKey} label="Status" required={false} error={errors[statusKey]?.[0]}><Input id={statusKey} value={values[statusKey]} onChange={(event) => setValue(statusKey, event.target.value)} {...inputProps(statusKey)} /></Field>
              <Field id={parentKey} label="Nama ayah/ibu" required={false} error={errors[parentKey]?.[0]}><Input id={parentKey} value={values[parentKey]} onChange={(event) => setValue(parentKey, event.target.value)} {...inputProps(parentKey)} /></Field>
            </div></div>;
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b"><CardTitle>Alamat dan tanggal dokumen</CardTitle><CardDescription>Data ini ditempatkan pada bagian akhir formulir DPCP.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2"><Field id="alamatPensiun" label="Alamat sesudah pensiun" error={errors.alamatPensiun?.[0]}><Textarea id="alamatPensiun" value={values.alamatPensiun} onChange={(event) => setValue("alamatPensiun", event.target.value)} disabled={busy} aria-invalid={Boolean(errors.alamatPensiun?.length)} rows={3} className={cn(extractionResult?.confidence.alamatPensiun === "low" && values.alamatPensiun && "border-amber-400 bg-amber-50")} /></Field></div>
          <Field id="tglDpcp" label="Tanggal DPCP" error={errors.tglDpcp?.[0]} description={values.tglDpcp ? `Ditampilkan sebagai ${formatIndonesianDate(values.tglDpcp)}.` : undefined}><Input id="tglDpcp" type="date" value={values.tglDpcp} onChange={(event) => setValue("tglDpcp", event.target.value)} {...inputProps("tglDpcp")} /></Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-xl border bg-white/95 p-4 shadow-lg backdrop-blur">
        <p className="hidden text-xs leading-5 text-zinc-500 sm:block">Kolom bertanda <span className="text-destructive">*</span> wajib diisi. Dokumen mengikuti format DPCP asli.</p>
        <Button type="submit" size="lg" disabled={busy || employees.length === 0} className="ml-auto min-w-48">
          {submitting ? <><LoaderCircle className="animate-spin" />Membuat DPCP...</> : <><Download />Buat dan unduh DOCX</>}
        </Button>
      </div>
    </form>
  );
}
