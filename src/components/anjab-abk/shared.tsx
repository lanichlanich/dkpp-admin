"use client";

import type { ReactNode } from "react";
import type { AnjabPlan, SourceCatalog, calculateAnjab } from "@/lib/anjab-abk-calculation";

export type EditorProps = { catalog: SourceCatalog; plan: AnjabPlan; result: ReturnType<typeof calculateAnjab>; edit: (recipe: (draft: AnjabPlan) => void) => void };
export const format = (value: number | null, digits = 0) => value !== null && Number.isFinite(value) ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(value) : "Belum lengkap";
export const inputClass = "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100";
export function NumberField({ label, value, onChange, integer = false, positive = false, percent = false, hideLabel = false }: { label: string; value: number; onChange: (value: number) => void; integer?: boolean; positive?: boolean; percent?: boolean; hideLabel?: boolean }) {
  return <label className={`block min-w-0 text-sm ${hideLabel ? "" : "space-y-1.5"}`}><span className={hideLabel ? "sr-only" : "block font-medium text-zinc-700"}>{label}</span><input type="number" inputMode={integer ? "numeric" : "decimal"} min={positive ? "0.000000001" : 0} max={percent ? 100 : undefined} step={integer ? 1 : "any"} required value={Number.isFinite(value) ? value : ""} onChange={event => onChange(event.target.value === "" ? NaN : Number(event.target.value))} className={inputClass} /></label>;
}
export function Metric({ label, value, detail }: { label: string; value: number | null; detail?: string }) {
  return <div className="rounded-xl border bg-white p-4"><p className="text-sm text-zinc-500">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-900">{format(value)}</p>{detail && <p className="mt-1 text-xs text-zinc-500">{detail}</p>}</div>;
}
export function Section({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  return <section className="min-w-0 overflow-hidden rounded-xl border bg-white"><div className="border-b bg-zinc-50/80 p-4"><h2 className="font-semibold">{title}</h2>{detail && <p className="mt-1 text-sm text-zinc-500">{detail}</p>}</div>{children}</section>;
}
export function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3 text-sm"><span className="text-zinc-500">{total} butir · Halaman {page} dari {pages}</span><div className="flex gap-2"><button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className="rounded-lg border px-3 py-1.5 hover:bg-zinc-50 disabled:opacity-40">Sebelumnya</button><button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className="rounded-lg border px-3 py-1.5 hover:bg-zinc-50 disabled:opacity-40">Berikutnya</button></div></div>;
}
