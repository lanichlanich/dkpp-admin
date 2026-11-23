"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { manageNewsAction } from "@/app/dashboard/berita/actions";

export function NewsOperation({ fields, confirm, children, label, danger }: {
  fields: Record<string, string>; confirm?: string; children?: ReactNode; label: string; danger?: boolean;
}) {
  const [state, action, pending] = useActionState(manageNewsAction, { ok: false, message: "" });
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const Icon = pending ? LoaderCircle : danger ? Trash2 : fields.id ? Save : Plus;
  return <form ref={form} action={action} onSubmit={event => {
    if (confirm && !confirmed.current) event.preventDefault();
    confirmed.current = false;
  }}>
    <fieldset disabled={pending} className="flex flex-wrap items-center gap-2">
      {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {children}
      {confirm ? <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger render={<Button type="button" variant="destructive" disabled={pending}/> }><Icon aria-hidden className={pending ? "animate-spin" : undefined}/>{pending ? "Memproses…" : label}</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogMedia className="bg-destructive/10 text-destructive"><Trash2 aria-hidden/></AlertDialogMedia><AlertDialogTitle>Konfirmasi penghapusan</AlertDialogTitle><AlertDialogDescription className="break-words">{confirm}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction type="button" variant="destructive" onClick={() => { confirmed.current = true; form.current?.requestSubmit(); setOpen(false); }}><Trash2 aria-hidden/> Hapus permanen</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog> : <Button type="submit" variant={fields.id ? "outline" : "default"} disabled={pending}><Icon aria-hidden className={pending ? "animate-spin" : undefined}/>{pending ? "Memproses…" : label}</Button>}
    </fieldset>
    {state.message && <p role={state.ok ? "status" : "alert"} className={`mt-1 flex max-w-56 items-start gap-1.5 text-sm whitespace-normal ${state.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}>{state.ok ? <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0"/> : <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0"/>}{state.message}</p>}
  </form>;
}
