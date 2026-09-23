"use client";

import { useState } from "react";
import { Download, FilePenLine, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatIndonesianDate } from "@/lib/kgb";

type FormValues = {
  tanggalSurat: string;
  nomorSurat: string;
  nomorUrut: string;
  fileYangDikirim: string;
  jumlah: string;
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

export function SuratPengantarForm({ today }: { today: string }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({
    tanggalSurat: today,
    nomorSurat: "",
    nomorUrut: "1",
    fileYangDikirim: "",
    jumlah: "1",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  function setValue(key: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: [] }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    toast.info("Surat pengantar sedang disusun...");
    try {
      const response = await fetch("/api/surat-pengantar/generate", {
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
      anchor.download = `Surat-Pengantar-${values.tanggalSurat}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Surat pengantar berhasil dibuat, diunduh, dan disimpan ke daftar dokumen.");
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
          <CardTitle className="flex items-center gap-2"><FilePenLine className="size-5 text-indigo-600" />Isian tag template</CardTitle>
          <CardDescription>Setiap kolom mengganti satu teks yang berada di dalam tanda &lt;&gt; pada template surat pengantar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field id="tanggalSurat" label="Tanggal surat" error={errors.tanggalSurat?.[0]} description="Mengganti tag <tanggal>.">
            <Input id="tanggalSurat" type="date" value={values.tanggalSurat} onChange={(event) => setValue("tanggalSurat", event.target.value)} {...inputProps("tanggalSurat")} />
          </Field>
          <Field id="nomorSurat" label="Nomor surat" error={errors.nomorSurat?.[0]} description="Mengganti tag <no surat>. Masukkan nomor lengkap.">
            <Input id="nomorSurat" value={values.nomorSurat} onChange={(event) => setValue("nomorSurat", event.target.value)} placeholder="Contoh: 800.1.11.1/3001/Sekre" {...inputProps("nomorSurat")} />
          </Field>
          <Field id="nomorUrut" label="Nomor urut" error={errors.nomorUrut?.[0]} description="Mengganti tag <no> pada kolom pertama tabel.">
            <Input id="nomorUrut" type="number" min="1" max="9999" step="1" value={values.nomorUrut} onChange={(event) => setValue("nomorUrut", event.target.value)} {...inputProps("nomorUrut")} />
          </Field>
          <Field id="jumlah" label="Jumlah bundle" error={errors.jumlah?.[0]} description="Mengganti tag <jumlah>; kata bundle tetap berasal dari template.">
            <Input id="jumlah" type="number" min="1" max="9999" step="1" value={values.jumlah} onChange={(event) => setValue("jumlah", event.target.value)} {...inputProps("jumlah")} />
          </Field>
          <div className="md:col-span-2">
            <Field id="fileYangDikirim" label="File yang dikirim" error={errors.fileYangDikirim?.[0]} description="Mengganti tag <file yang dikirim>. Gunakan satu baris agar tata letak tabel tetap stabil.">
              <Textarea id="fileYangDikirim" value={values.fileYangDikirim} onChange={(event) => setValue("fileYangDikirim", event.target.value)} disabled={submitting} aria-invalid={Boolean(errors.fileYangDikirim?.length)} rows={3} placeholder="Contoh: Berkas usulan kenaikan pangkat periode Oktober 2026" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-950"><ShieldCheck className="size-4" />Format tabel dan penanda TTE dipertahankan</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">Tanggal ditulis sebagai {formatIndonesianDate(values.tanggalSurat) || "tanggal Indonesia"}. Kop, penerima, keterangan, dan tanda tangan tidak diubah.</p>
          </div>
          <Button type="submit" size="lg" disabled={submitting} className="min-w-56">
            {submitting ? <><LoaderCircle className="animate-spin" />Membuat dokumen...</> : <><Download />Buat dan unduh DOCX</>}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
