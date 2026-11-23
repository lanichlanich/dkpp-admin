"use client";

import { useActionState, type ReactNode } from "react";
import { manageNewsAction } from "@/app/dashboard/berita/actions";

export function NewsOperation({ fields, confirm, children, label, danger }: {
  fields: Record<string, string>; confirm?: string; children?: ReactNode; label: string; danger?: boolean;
}) {
  const [state, action, pending] = useActionState(manageNewsAction, { ok: false, message: "" });
  return <form action={action} onSubmit={event => { if (confirm && !window.confirm(confirm)) event.preventDefault(); }}>
    <fieldset disabled={pending} className="flex flex-wrap items-center gap-2">
      {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {children}
      <button type="submit" className={`min-h-11 rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50 ${danger ? "text-red-700 dark:text-red-300" : ""}`}>{pending ? "Memproses…" : label}</button>
    </fieldset>
    {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-red-700 dark:text-red-300"}>{state.message}</p>}
  </form>;
}
