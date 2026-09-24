"use client";

import { useActionState, useEffect, useState } from "react";
import { LoaderCircle, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { saveEmployeeAction } from "@/actions/employees";
import { FieldError, FormMessage } from "@/components/auth/form-message";
import { SearchableSelect } from "@/components/employees/searchable-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Employee } from "@/lib/db";
import type { EmployeeOptions } from "@/lib/employees";

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return <Label htmlFor={htmlFor}>{children}<span className="ml-1 text-red-500" aria-hidden="true">*</span></Label>;
}

function EmployeeSubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="min-w-36 bg-indigo-600 text-white hover:bg-indigo-700">{pending && <LoaderCircle className="size-4 animate-spin" />}{pending ? "Menyimpan..." : editing ? "Simpan perubahan" : "Tambah pegawai"}</Button>;
}

export function EmployeeFormDialog({ employee, options }: { employee?: Employee; options: EmployeeOptions }) {
  const editing = Boolean(employee);
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveEmployeeAction, {});
  const router = useRouter();

  useEffect(() => {
    if (!state.submittedAt) return;
    if (state.status === "success") {
      toast.success(state.message);
      const timeout = window.setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 0);
      return () => window.clearTimeout(timeout);
    } else if (state.message) {
      toast.error(state.message);
    } else {
      toast.warning("Periksa kembali isian yang ditandai.");
    }
  }, [state, router]);

  return (
    <>
      {editing ? (
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label={`Edit ${employee?.name}`}><Pencil className="size-3.5" /></Button>
      ) : (
        <Button onClick={() => setOpen(true)} className="bg-indigo-600 text-white hover:bg-indigo-700"><Plus className="size-4" />Tambah pegawai</Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>{editing ? "Edit data pegawai" : "Tambah pegawai"}</DialogTitle><DialogDescription>Kolom bertanda <span className="text-red-500">*</span> wajib diisi. Validasi akhir dilakukan di server.</DialogDescription></DialogHeader>
          <form action={action} className="space-y-5">
            <input type="hidden" name="mode" value={editing ? "edit" : "create"} />
            <input type="hidden" name="originalNip" value={employee?.nip ?? ""} />
            <FormMessage status={state.status} message={state.status === "error" ? state.message : undefined} />
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2"><RequiredLabel htmlFor="nip">NIP</RequiredLabel><Input id="nip" name="nip" inputMode="numeric" maxLength={18} pattern="[0-9]{18}" defaultValue={employee?.nip} readOnly={editing} required className="h-11 font-mono read-only:bg-zinc-100" aria-invalid={Boolean(state.errors?.nip)} /><p className="text-xs text-zinc-500">Tepat 18 digit dan digunakan sebagai primary key.</p><FieldError messages={state.errors?.nip} /></div>
              <div className="space-y-2"><RequiredLabel htmlFor="name">Nama lengkap</RequiredLabel><Input id="name" name="name" defaultValue={employee?.name} required className="h-11" aria-invalid={Boolean(state.errors?.name)} /><p className="text-xs text-zinc-500">Tuliskan nama beserta gelar sesuai data kepegawaian.</p><FieldError messages={state.errors?.name} /></div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2"><RequiredLabel htmlFor="parentUnit">Unor induk</RequiredLabel><SearchableSelect name="parentUnit" options={options.parentUnits} defaultValue={employee?.parentUnit} placeholder="Pilih unor induk" searchPlaceholder="Cari unor induk..." invalid={Boolean(state.errors?.parentUnit)} /><FieldError messages={state.errors?.parentUnit} /></div>
              <div className="space-y-2"><RequiredLabel htmlFor="unit">Unor</RequiredLabel><SearchableSelect name="unit" options={options.units} defaultValue={employee?.unit} placeholder="Pilih unit organisasi" searchPlaceholder="Cari unor..." invalid={Boolean(state.errors?.unit)} /><FieldError messages={state.errors?.unit} /></div>
            </div>
            <div className="space-y-2"><RequiredLabel htmlFor="position">Jabatan</RequiredLabel><SearchableSelect name="position" options={options.positions} defaultValue={employee?.position} placeholder="Pilih jabatan" searchPlaceholder="Cari jabatan..." invalid={Boolean(state.errors?.position)} /><FieldError messages={state.errors?.position} /></div>
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2"><RequiredLabel htmlFor="positionType">Jenis jabatan</RequiredLabel><SearchableSelect name="positionType" options={options.positionTypes} defaultValue={employee?.positionType} placeholder="Pilih jenis" invalid={Boolean(state.errors?.positionType)} /><FieldError messages={state.errors?.positionType} /></div>
              <div className="space-y-2"><RequiredLabel htmlFor="echelon">Eselon</RequiredLabel><SearchableSelect name="echelon" options={options.echelons} defaultValue={employee?.echelon} placeholder="Pilih eselon" invalid={Boolean(state.errors?.echelon)} /><FieldError messages={state.errors?.echelon} /></div>
              <div className="space-y-2"><RequiredLabel htmlFor="rank">Golongan/pangkat</RequiredLabel><SearchableSelect name="rank" options={options.ranks} defaultValue={employee?.rank} placeholder="Pilih golongan" searchPlaceholder="Cari golongan..." invalid={Boolean(state.errors?.rank)} /><FieldError messages={state.errors?.rank} /></div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2"><RequiredLabel htmlFor="asnType">Jenis ASN</RequiredLabel><SearchableSelect name="asnType" options={options.asnTypes} defaultValue={employee?.asnType} placeholder="Pilih jenis ASN" invalid={Boolean(state.errors?.asnType)} /><FieldError messages={state.errors?.asnType} /></div>
              <div className="space-y-2"><RequiredLabel htmlFor="gender">Jenis kelamin</RequiredLabel><SearchableSelect name="gender" options={["Laki-laki", "Perempuan", "Tidak diketahui"]} defaultValue={employee?.gender ?? "Tidak diketahui"} placeholder="Pilih jenis kelamin" invalid={Boolean(state.errors?.gender)} /><FieldError messages={state.errors?.gender} /></div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2"><RequiredLabel htmlFor="status">Status</RequiredLabel><SearchableSelect name="status" options={options.statuses} defaultValue={employee?.status ?? "Aktif"} placeholder="Pilih status" invalid={Boolean(state.errors?.status)} /><FieldError messages={state.errors?.status} /></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><EmployeeSubmitButton editing={editing} /></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
