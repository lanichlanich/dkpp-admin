"use client";

import { useState, useTransition } from "react";
import { FilePenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveHukdisAction, type HukdisFormState } from "@/actions/hukdis";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { hukdisSanctions, type HukdisRecord, type HukdisSanctionCode } from "@/lib/hukdis-types";

const initialState: HukdisFormState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

export function HukdisFormDialog({
  employee,
  period,
  record,
}: {
  employee: { nip: string; name: string; position: string };
  period: string;
  record?: HukdisRecord;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<HukdisSanctionCode | "none">(record?.sanctionCode ?? "none");
  const [decisionNumber, setDecisionNumber] = useState(record?.decisionNumber ?? "");
  const [decisionDate, setDecisionDate] = useState(record?.decisionDate ?? "");
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await saveHukdisAction(initialState, formData);
      setState(result);
      if (result.status === "success") {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else if (result.message) {
        toast.error(result.message);
      } else {
        toast.warning("Periksa kembali isian yang ditandai.");
      }
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setSelected(record?.sanctionCode ?? "none");
      setDecisionNumber(record?.decisionNumber ?? "");
      setDecisionDate(record?.decisionDate ?? "");
      setState(initialState);
    }
  }

  return (
    <>
      <Button type="button" variant={record ? "outline" : "ghost"} size="xs" onClick={() => handleOpenChange(true)}>
        <FilePenLine className="size-3" />{record ? "Edit" : "Isi"}
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Isian Hukdis - {employee.name}</DialogTitle>
          <DialogDescription>{employee.nip} · {employee.position}</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-5">
          <input type="hidden" name="employeeNip" value={employee.nip} />
          <input type="hidden" name="reportPeriod" value={period} />

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-zinc-900">Jenis hukuman disiplin</legend>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-zinc-50">
              <input type="radio" name="sanctionCode" value="none" checked={selected === "none"} onChange={() => setSelected("none")} className="size-4 accent-indigo-600" />
              <span><span className="block font-medium">Tidak ada hukdis</span><span className="text-xs text-zinc-500">Kosongkan isian pegawai pada periode ini.</span></span>
            </label>
            <div className="grid gap-2 md:grid-cols-2">
              {hukdisSanctions.map((sanction) => (
                <label key={sanction.code} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-zinc-50">
                  <input type="radio" name="sanctionCode" value={sanction.code} checked={selected === sanction.code} onChange={() => setSelected(sanction.code)} className="mt-0.5 size-4 accent-indigo-600" />
                  <span><span className="block text-xs font-semibold uppercase tracking-wide text-indigo-600">{sanction.level}</span><span className="mt-0.5 block text-sm leading-5">{sanction.label}</span></span>
                </label>
              ))}
            </div>
            <FieldError messages={state.errors?.sanctionCode} />
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor={`decision-number-${employee.nip}`} className="text-sm font-medium">Nomor keputusan</label>
              <Input id={`decision-number-${employee.nip}`} name="decisionNumber" value={decisionNumber} onChange={(event) => setDecisionNumber(event.target.value)} disabled={selected === "none"} placeholder="Contoh: 800.1.6/123-BKPSDM" />
              <FieldError messages={state.errors?.decisionNumber} />
            </div>
            <div className="space-y-2">
              <label htmlFor={`decision-date-${employee.nip}`} className="text-sm font-medium">Tanggal keputusan</label>
              <Input id={`decision-date-${employee.nip}`} name="decisionDate" type="date" value={decisionDate} onChange={(event) => setDecisionDate(event.target.value)} disabled={selected === "none"} />
              <FieldError messages={state.errors?.decisionDate} />
            </div>
          </div>
          {state.message && state.status === "error" && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : selected === "none" ? "Kosongkan isian" : "Simpan Hukdis"}</Button>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
