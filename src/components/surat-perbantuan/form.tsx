"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Download, FilePenLine, LoaderCircle, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatIndonesianDate } from "@/lib/kgb";
import { perbantuanRank, suratPerbantuanSchema, type SuratPerbantuanEmployee, type SuratPerbantuanInput } from "@/lib/surat-perbantuan-validation";

export function SuratPerbantuanForm({ employees }: { employees: SuratPerbantuanEmployee[] }) {
  const router = useRouter();
  const [values, setValues] = useState<SuratPerbantuanInput>({
    employeeNip: "", nomorSurat: "", tanggalSurat: "", jabatanPerbantuan: "", unitKerjaPerbantuan: "",
  });
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const selected = employees.find((employee) => employee.nip === values.employeeNip);
  const rank = perbantuanRank(selected?.rank ?? "");
  const positions = [...new Set(employees.map((employee) => employee.position).filter(Boolean))].sort();
  const units = [...new Set(employees.map((employee) => employee.unit).filter(Boolean))].sort();

  function setValue(key: keyof SuratPerbantuanInput, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = suratPerbantuanSchema.safeParse(values);
    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors);
      toast.error("Periksa kembali isian surat.");
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const response = await fetch("/api/surat-perbantuan/generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.data),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Surat gagal dibuat." }));
        setErrors(payload.errors ?? {});
        throw new Error(payload.message ?? "Surat gagal dibuat.");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]
        ?? `Surat-Perbantuan-${values.employeeNip}-${values.tanggalSurat}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success("Surat perbantuan dibuat, diunduh, dan disimpan ke arsip.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Surat gagal dibuat.");
    } finally {
      setSubmitting(false);
    }
  }

  const errorMessage = (key: keyof SuratPerbantuanInput) => errors[key]?.[0]
    ? <p id={`${key}-error`} className="text-xs font-medium text-destructive" role="alert">{errors[key]?.[0]}</p> : null;
  const inputProps = (key: keyof SuratPerbantuanInput) => ({
    id: key, value: values[key], disabled: submitting, required: true,
    "aria-invalid": Boolean(errors[key]?.length),
    "aria-describedby": errors[key]?.length ? `${key}-error` : undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValue(key, event.target.value),
  });

  return <form onSubmit={submit} className="space-y-6" noValidate>
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2"><UserRound className="size-5 text-indigo-600" />Pegawai yang ditugaskan</CardTitle>
        <CardDescription>Pilih pegawai aktif untuk mengisi identitas pada surat tugas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="employeeNip">Pegawai <span className="text-destructive">*</span></Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger render={<Button id="employeeNip" type="button" variant="outline" role="combobox" aria-expanded={open}
              aria-invalid={Boolean(errors.employeeNip?.length)} aria-describedby={errors.employeeNip?.length ? "employeeNip-error" : undefined}
              disabled={submitting || !employees.length} className="h-11 w-full justify-between overflow-hidden font-normal" />}>
              <span className="truncate">{selected ? `${selected.name} · ${selected.nip}` : "Pilih pegawai"}</span><ChevronsUpDown className="size-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
              <Command>
                <CommandInput placeholder="Cari nama, NIP, jabatan, atau unit kerja..." />
                <CommandList><CommandEmpty>Pegawai tidak ditemukan.</CommandEmpty><CommandGroup>
                  {employees.map((employee) => <CommandItem key={employee.nip} value={`${employee.name} ${employee.nip} ${employee.position} ${employee.unit}`}
                    onSelect={() => { setValue("employeeNip", employee.nip); setOpen(false); }}>
                    <Check className={`size-4 shrink-0 ${employee.nip === values.employeeNip ? "opacity-100" : "opacity-0"}`} />
                    <span className="min-w-0"><span className="block truncate font-medium">{employee.name}</span>
                      <span className="block truncate text-xs text-zinc-500">{employee.nip} · {employee.position}</span></span>
                  </CommandItem>)}
                </CommandGroup></CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {errorMessage("employeeNip")}
          {!employees.length && <p className="text-sm text-amber-700">Belum ada pegawai aktif. Tambahkan data melalui Daftar Pegawai.</p>}
        </div>
        {selected && <dl className="grid gap-4 rounded-lg border bg-zinc-50 p-4 text-sm sm:grid-cols-2">
          {[
            ["Nama pegawai", selected.name], ["NIP / Nomor Induk PPPK", selected.nip],
            ["Pangkat / Golongan", `${rank.pangkat} / ${rank.golongan}`], ["Jenis ASN", selected.asnType],
            ["Jabatan", selected.position], ["Unit kerja", selected.unit],
          ].map(([label, value]) => <div key={label}><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-1 font-medium text-zinc-900">{value || "-"}</dd></div>)}
        </dl>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2"><FilePenLine className="size-5 text-indigo-600" />Data surat dan perbantuan</CardTitle>
        <CardDescription>Isi tanggal penetapan dan penugasan perbantuan yang akan dicantumkan pada surat.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nomorSurat">Nomor urut surat <span className="text-destructive">*</span></Label>
          <Input {...inputProps("nomorSurat")} maxLength={30} placeholder="Contoh: 1234" />
          <p className="break-words text-xs text-zinc-500">Nomor lengkap: 800.1.11.1 / {values.nomorSurat || "…"} / Sekret.</p>
          {errorMessage("nomorSurat")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="tanggalSurat">Tanggal surat / penetapan <span className="text-destructive">*</span></Label>
          <Input {...inputProps("tanggalSurat")} type="date" />
          <p className="text-xs text-zinc-500">{formatIndonesianDate(values.tanggalSurat) || "Pilih tanggal secara manual."} Surat berlaku sejak tanggal penetapan.</p>
          {errorMessage("tanggalSurat")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="jabatanPerbantuan">Jabatan perbantuan <span className="text-destructive">*</span></Label>
          <Input {...inputProps("jabatanPerbantuan")} list="perbantuan-positions" maxLength={180} placeholder="Isi jabatan penugasan perbantuan" />
          <datalist id="perbantuan-positions">{positions.map((value) => <option key={value} value={value} />)}</datalist>
          {errorMessage("jabatanPerbantuan")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="unitKerjaPerbantuan">Unit kerja perbantuan <span className="text-destructive">*</span></Label>
          <Input {...inputProps("unitKerjaPerbantuan")} list="perbantuan-units" maxLength={240} placeholder="Isi unit kerja tujuan perbantuan" />
          <datalist id="perbantuan-units">{units.map((value) => <option key={value} value={value} />)}</datalist>
          {errorMessage("unitKerjaPerbantuan")}
        </div>
      </CardContent>
    </Card>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-xl text-sm leading-6 text-zinc-500">Dokumen Word menggunakan template surat tugas perbantuan dan tersimpan di arsip untuk diunduh kembali.</p>
      <Button type="submit" size="lg" disabled={submitting || !employees.length} className="shrink-0">
        {submitting ? <><LoaderCircle className="animate-spin" />Membuat dokumen...</> : <><Download />Buat dan unduh DOCX</>}
      </Button>
    </div>
  </form>;
}
