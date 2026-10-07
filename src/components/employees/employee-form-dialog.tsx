"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, ChevronsUpDown, LoaderCircle, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { saveEmployeeAction } from "@/actions/employees";
import { FieldError, FormMessage } from "@/components/auth/form-message";
import { SearchableSelect } from "@/components/employees/searchable-select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Employee } from "@/lib/db";
import type { EmployeeOptions } from "@/lib/employees";
import { isInactiveJobPositionName } from "@/lib/job-position-visibility";
import { cn } from "@/lib/utils";

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
  const initialPositionId = employee?.jobPositionId ?? options.positions.find((position) => position.name === employee?.position && position.unit === employee?.unit)?.id ?? "";
  const [positionId, setPositionId] = useState(initialPositionId);
  const [positionOpen, setPositionOpen] = useState(false);
  const selectedPosition = options.positions.find((position) => position.id === positionId)
    ?? (employee && isInactiveJobPositionName(employee.position) ? {
      id: employee.jobPositionId ?? "",
      name: `${employee.position} (nonaktif)`,
      unit: employee.unit,
      positionType: employee.positionType,
      echelon: employee.echelon,
    } : undefined);
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
      <Dialog open={open} onOpenChange={(nextOpen) => { if (nextOpen) setPositionId(initialPositionId); setOpen(nextOpen); }}>
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
              <div className="space-y-2"><Label>Unor penempatan</Label><div className="flex h-11 items-center rounded-lg border bg-zinc-50 px-3 text-sm text-zinc-700">{selectedPosition?.unit ?? "Terisi otomatis dari jabatan"}</div></div>
            </div>
            <input type="hidden" name="jobPositionId" value={positionId} />
            <div className="space-y-2"><RequiredLabel htmlFor="jobPositionId">Jabatan</RequiredLabel><Popover open={positionOpen} onOpenChange={setPositionOpen}><PopoverTrigger render={<Button id="jobPositionId" type="button" variant="outline" role="combobox" aria-expanded={positionOpen} aria-invalid={Boolean(state.errors?.jobPositionId)} className="h-11 w-full justify-between overflow-hidden px-3 font-normal" />}><span className={cn("min-w-0 truncate text-left", !selectedPosition && "text-muted-foreground")}>{selectedPosition ? `${selectedPosition.name} · ${selectedPosition.unit} · ${selectedPosition.positionType}/${selectedPosition.echelon}` : "Pilih jabatan dan unit..."}</span><ChevronsUpDown className="size-4 shrink-0 opacity-50" /></PopoverTrigger><PopoverContent align="start" className="w-[var(--anchor-width)] p-0"><Command><CommandInput placeholder="Cari jabatan atau unit..." /><CommandList className="max-h-72"><CommandEmpty>Jabatan tidak ditemukan.</CommandEmpty><CommandGroup>{options.positions.map((position) => <CommandItem key={position.id} value={`${position.name} ${position.unit} ${position.positionType} ${position.echelon}`} onSelect={() => { setPositionId(position.id); setPositionOpen(false); }}><Check className={cn("size-4 shrink-0", positionId === position.id ? "opacity-100" : "opacity-0")} /><span className="min-w-0"><span className="block truncate">{position.name}</span><span className="block truncate text-xs text-zinc-500">{position.unit} · {position.positionType} · {position.echelon}</span></span></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover><FieldError messages={state.errors?.jobPositionId} /></div>
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2"><Label htmlFor="positionTypeDisplay">Jenis jabatan</Label><Input id="positionTypeDisplay" value={selectedPosition?.positionType ?? ""} readOnly className="h-11 bg-zinc-50" /></div>
              <div className="space-y-2"><Label htmlFor="echelonDisplay">Eselon</Label><Input id="echelonDisplay" value={selectedPosition?.echelon ?? ""} readOnly className="h-11 bg-zinc-50" /></div>
              <div className="space-y-2"><RequiredLabel htmlFor="rank">Golongan/pangkat</RequiredLabel><SearchableSelect name="rank" options={options.ranks} defaultValue={employee?.rank} placeholder="Pilih golongan" searchPlaceholder="Cari golongan..." invalid={Boolean(state.errors?.rank)} /><FieldError messages={state.errors?.rank} /></div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2"><RequiredLabel htmlFor="asnType">Jenis ASN</RequiredLabel><SearchableSelect name="asnType" options={options.asnTypes} defaultValue={employee?.asnType} placeholder="Pilih jenis ASN" invalid={Boolean(state.errors?.asnType)} /><FieldError messages={state.errors?.asnType} /></div>
              <div className="space-y-2"><RequiredLabel htmlFor="status">Status</RequiredLabel><SearchableSelect name="status" options={options.statuses} defaultValue={employee?.status ?? "Aktif"} placeholder="Pilih status" invalid={Boolean(state.errors?.status)} /><FieldError messages={state.errors?.status} /></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><EmployeeSubmitButton editing={editing} /></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
