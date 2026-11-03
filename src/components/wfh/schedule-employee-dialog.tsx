"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { addScheduleEmployee } from "@/actions/wfh-schedule";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScheduleEmployee, WorkLocation } from "@/lib/wfh-schedule";

export function ScheduleEmployeeDialog({ period, label, employees, onClose, onAdded }: {
  period: string; label: string; employees: ScheduleEmployee[]; onClose: () => void; onAdded: (nip: string) => void;
}) {
  const router = useRouter(), [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(""), [nip, setNip] = useState(""), [status, setStatus] = useState<WorkLocation>("WFO"), [error, setError] = useState("");
  const selected = employees.find(employee => employee.nip === nip);
  const search = query.trim().toLocaleLowerCase("id-ID");
  const candidates = employees.filter(employee => `${employee.name} ${employee.nip} ${employee.unit} ${employee.position}`.toLocaleLowerCase("id-ID").includes(search));
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || pending) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await addScheduleEmployee(period, selected.nip, status);
        if (!result.success) { setError(result.message); router.refresh(); return; }
        onAdded(selected.nip); toast.success(result.message); onClose(); router.refresh();
      } catch { setError("Pegawai gagal ditambahkan. Silakan coba lagi."); }
    });
  }
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" showCloseButton={!pending}>
    <DialogHeader><DialogTitle>Tambah pegawai WFH/WFO</DialogTitle><DialogDescription>Pilih pegawai aktif untuk jadwal {label}. Pegawai yang sudah terdaftar tidak ditampilkan.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="schedule-add-search">Cari pegawai aktif</Label><Input id="schedule-add-search" type="search" value={query} onChange={event => { setQuery(event.target.value); setNip(""); }} placeholder="Cari nama, NIP, jabatan, atau unit…" /></div>
      <div className="max-h-60 overflow-y-auto rounded-lg border"><ul aria-label="Pilihan pegawai aktif" className="divide-y">{candidates.map(employee => <li key={employee.nip}><button type="button" disabled={pending} aria-pressed={nip === employee.nip} onClick={() => setNip(employee.nip)} className={`flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-600 ${nip === employee.nip ? "bg-emerald-50 text-emerald-950" : "bg-white"}`}>
        <span className="min-w-0 flex-1"><span className="block font-medium">{employee.name}</span><span className="mt-0.5 block font-mono text-xs text-zinc-500">{employee.nip}</span><span className="mt-1 block text-xs text-zinc-500">{employee.position} · {employee.unit}</span></span>{nip === employee.nip && <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-emerald-700" />}
      </button></li>)}</ul>{!candidates.length && <p className="p-5 text-center text-sm text-zinc-500">{employees.length ? "Pegawai tidak ditemukan." : "Tidak ada pegawai aktif yang dapat ditambahkan."}</p>}</div>
      <div className="space-y-2"><Label htmlFor="schedule-add-status">Status awal</Label><select id="schedule-add-status" value={status} onChange={event => setStatus(event.target.value as WorkLocation)} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"><option value="WFO">WFO · Bekerja dari kantor</option><option value="WFH">WFH · Bekerja dari rumah</option></select><p className="text-xs text-zinc-500">Status awal berlaku untuk seluruh Jumat pada {label} dan dapat diubah per tanggal.</p></div>
    </fieldset>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Batal</Button><Button type="submit" disabled={pending || !selected} className="bg-emerald-700 text-white hover:bg-emerald-800">{pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Plus aria-hidden="true" className="size-4" />}{pending ? "Menambahkan…" : "Tambah ke jadwal"}</Button></DialogFooter></form>
  </DialogContent></Dialog>;
}
