"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { KerjakuEmployee } from "@/lib/pembukaan-kerjaku-document";
import type { KerjakuRequestHistory } from "@/lib/pembukaan-kerjaku";
import { LetterNumberField } from "@/components/letters/letter-number-field";
import { letterClassificationDefaults } from "@/lib/letter-classification";

function monthLabel(period: string) {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${period}-01T00:00:00Z`));
}

export function PembukaanKerjakuForm({ employees, history, today }: {
  employees: KerjakuEmployee[]; history: KerjakuRequestHistory[]; today: string;
}) {
  const router = useRouter();
  const [tanggalSurat, setTanggalSurat] = useState(today);
  const [nomorSurat, setNomorSurat] = useState("");
  const [bulanDibuka, setBulanDibuka] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const byNip = new Map(employees.map((employee) => [employee.nip, employee]));
  const available = employees.filter((employee) => !selected.includes(employee.nip));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected.length === 0) {
      setErrors({ employeeNips: ["Pilih setidaknya satu pegawai."] });
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const response = await fetch("/api/pembukaan-kerjaku/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tanggalSurat, nomorSurat, bulanDibuka, employeeNips: selected }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Surat gagal dibuat." }));
        setErrors(payload.errors ?? {});
        throw new Error(payload.message ?? "Surat gagal dibuat.");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Permohonan-Pembukaan-Kerjaku-${bulanDibuka}-${tanggalSurat}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Surat berhasil dibuat, diunduh, dan disimpan.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Surat gagal dibuat.");
    } finally { setSubmitting(false); }
  }

  return <>
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader className="border-b"><CardTitle>Data surat</CardTitle><CardDescription>Isi nomor lengkap sesuai surat keluar dan pilih bulan yang akan dibuka kembali.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2"><LetterNumberField value={nomorSurat} onChange={setNomorSurat} defaultCode={letterClassificationDefaults.kerjaku} placeholder="123-Sekret" disabled={submitting} error={errors.nomorSurat?.[0]} /></div>
          <div className="space-y-2"><Label htmlFor="tanggalSurat">Tanggal surat</Label><Input id="tanggalSurat" type="date" value={tanggalSurat} onChange={(e) => setTanggalSurat(e.target.value)} disabled={submitting} required />{errors.tanggalSurat?.[0] && <p className="text-xs text-destructive">{errors.tanggalSurat[0]}</p>}</div>
          <div className="space-y-2"><Label htmlFor="bulanDibuka">Bulan yang dibuka</Label><Input id="bulanDibuka" type="month" value={bulanDibuka} onChange={(e) => setBulanDibuka(e.target.value)} disabled={submitting} required />{errors.bulanDibuka?.[0] && <p className="text-xs text-destructive">{errors.bulanDibuka[0]}</p>}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b"><CardTitle>Lampiran pegawai ({selected.length})</CardTitle><CardDescription>Pilih pegawai aktif satu per satu. Urutan di bawah mengikuti nomor dalam lampiran surat.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger render={<Button type="button" variant="outline" disabled={submitting || available.length === 0} className="w-full justify-start sm:w-80" />}><Plus className="size-4" />Tambah pegawai</PopoverTrigger>
            <PopoverContent align="start" className="w-[min(90vw,28rem)] p-0">
              <Command><CommandInput placeholder="Cari nama atau NIP..." /><CommandList><CommandEmpty>Pegawai tidak ditemukan.</CommandEmpty><CommandGroup>
                {available.map((employee) => <CommandItem key={employee.nip} value={`${employee.name} ${employee.nip} ${employee.position}`} onSelect={() => { setSelected((current) => [...current, employee.nip]); setErrors((current) => ({ ...current, employeeNips: [] })); setOpen(false); }}>
                  <span className="min-w-0"><span className="block truncate font-medium">{employee.name}</span><span className="block truncate text-xs text-zinc-500">{employee.nip} · {employee.position}</span></span>
                </CommandItem>)}
              </CommandGroup></CommandList></Command>
            </PopoverContent>
          </Popover>
          {errors.employeeNips?.[0] && <p className="text-xs text-destructive" role="alert">{errors.employeeNips[0]}</p>}
          {selected.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-zinc-500">Belum ada pegawai dipilih.</p> :
            <ol className="divide-y rounded-lg border">{selected.map((nip, index) => { const employee = byNip.get(nip); return <li key={nip} className="flex items-center gap-3 p-3">
              <span className="w-6 shrink-0 text-sm text-zinc-500">{index + 1}.</span><div className="min-w-0 flex-1"><p className="font-medium">{employee?.name}</p><p className="text-xs text-zinc-500">{nip} · {employee?.position}</p></div>
              <Button type="button" variant="ghost" size="icon" disabled={submitting} aria-label={`Hapus ${employee?.name}`} onClick={() => setSelected((current) => current.filter((item) => item !== nip))}><Trash2 className="size-4" /></Button>
            </li>; })}</ol>}
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button type="submit" disabled={submitting} size="lg">{submitting ? <><LoaderCircle className="animate-spin" />Membuat surat...</> : <><Download />Buat dan unduh DOCX</>}</Button></div>
    </form>
    <Card><CardHeader className="border-b"><CardTitle>Riwayat surat</CardTitle><CardDescription>{history.length} surat tersimpan dan dapat diunduh ulang.</CardDescription></CardHeader><CardContent className="space-y-2">
      {history.length === 0 ? <p className="py-6 text-sm text-zinc-500">Belum ada surat.</p> : history.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div><p className="font-medium">{item.nomorSurat}</p><p className="text-xs text-zinc-500">{monthLabel(item.bulanDibuka)} · {item.employeeCount} pegawai · {item.tanggalSurat} · oleh {item.createdBy}</p></div>
        <Button variant="outline" size="sm" render={<a href={`/api/pembukaan-kerjaku/${item.id}/download`} />}><Download />Unduh</Button>
      </div>)}
    </CardContent></Card>
  </>;
}
