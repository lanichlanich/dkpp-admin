"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { manageNewsAction } from "@/app/dashboard/berita/actions";

export function NewsOperation({ fields, confirm, children, label, danger }: {
  fields: Record<string, string>; confirm?: string; children?: ReactNode; label: string; danger?: boolean;
}) {
  const [state, action, pending] = useActionState(manageNewsAction, { ok: false, message: "" });
  return <form action={action} onSubmit={event => { if (confirm && !window.confirm(confirm)) event.preventDefault(); }}>
    <fieldset disabled={pending} className="flex flex-wrap items-center gap-2">
      {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {children}
      <Button type="submit" variant={danger ? "destructive" : "outline"} disabled={pending}>{pending ? "Memproses…" : label}</Button>
    </fieldset>
    {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-red-700 dark:text-red-300"}>{state.message}</p>}
  </form>;
}
