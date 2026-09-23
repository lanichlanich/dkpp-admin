"use client";

import { useState } from "react";
import { Download, FilePenLine, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIndonesianDate } from "@/lib/kgb";
import { monthFromIsoDate, WFH_MONTHS, WFH_TEMPLATE_YEAR, type WfhMonth } from "@/lib/wfh";

type FormValues = {
  nomorSurat: string;
  bulanWfh: WfhMonth;
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

export function WfhForm({ today }: { today: string }) {
  const router = useRouter();
  const defaultMonth = monthFromIsoDate(today) ?? "Agustus";
  const [values, setValues] = useState<FormValues>({
    nomorSurat: "",
    bulanWfh: defaultMonth,
    tanggalSurat: today,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  function setValue<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: [] }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    toast.info("Surat tugas WFH sedang disusun...");
    try {
      const response = await fetch("/api/wfh/generate", {
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
      anchor.download = `Surat-Tugas-WFH-${values.tanggalSurat}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Surat tugas WFH berhasil dibuat, diunduh, dan disimpan ke daftar dokumen.");
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
          <CardTitle className="flex items-center gap-2"><FilePenLine className="size-5 text-indigo-600" />Isian tag template</CardTitle>
          <CardDescription>Setiap kolom mengganti satu teks yang berada di dalam tanda &lt;&gt; pada template surat tugas WFH.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field id="nomorSurat" label="Nomor surat" error={errors.nomorSurat?.[0]} description="Mengganti tag <800.1.11.1/2677/Sekre>. Masukkan nomor lengkap beserta kode dan sufiks.">
              <Input id="nomorSurat" value={values.nomorSurat} onChange={(event) => setValue("nomorSurat", event.target.value)} disabled={submitting} aria-invalid={Boolean(errors.nomorSurat?.length)} placeholder="800.1.11.1/2677/Sekre" className="h-10" />
            </Field>
          </div>
          <Field id="bulanWfh" label="Bulan WFH" error={errors.bulanWfh?.[0]} description="Mengganti tag <Agustus>.">
            <select id="bulanWfh" value={values.bulanWfh} onChange={(event) => setValue("bulanWfh", event.target.value as WfhMonth)} disabled={submitting} aria-invalid={Boolean(errors.bulanWfh?.length)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive">
              {WFH_MONTHS.map((month) => <option key={month} value={month}>{month}</option>)}
            </select>
          </Field>
          <Field id="tanggalSurat" label="Tanggal surat" error={errors.tanggalSurat?.[0]} description={`Mengganti tag <04 Agustus 2026>. Tahun ${WFH_TEMPLATE_YEAR} tetap mengikuti template.`}>
            <Input id="tanggalSurat" type="date" min={`${WFH_TEMPLATE_YEAR}-01-01`} max={`${WFH_TEMPLATE_YEAR}-12-31`} value={values.tanggalSurat} onChange={(event) => setValue("tanggalSurat", event.target.value)} disabled={submitting} aria-invalid={Boolean(errors.tanggalSurat?.length)} className="h-10" />
          </Field>
        </CardContent>
      </Card>

      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-950"><ShieldCheck className="size-4" />Format dan penanda TTE dipertahankan</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">Tanggal akan ditulis sebagai {formatIndonesianDate(values.tanggalSurat) || "tanggal Indonesia"}. Penanda tanda tangan elektronik tidak diubah.</p>
          </div>
          <Button type="submit" size="lg" disabled={submitting} className="min-w-56">
            {submitting ? <><LoaderCircle className="animate-spin" />Membuat dokumen...</> : <><Download />Buat dan unduh DOCX</>}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
