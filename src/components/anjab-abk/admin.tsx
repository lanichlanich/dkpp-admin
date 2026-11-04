"use client";

import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Calculator, FileSpreadsheet, LoaderCircle, RotateCcw, Save } from "lucide-react";
import type { AnjabPlanRecord } from "@/lib/anjab-abk";
import { calculateAnjab, createAnjabPlanSchema, defaultAnjabPlan, validAnjabYear, type AnjabPlan, type SourceCatalog } from "@/lib/anjab-abk-calculation";
import { AnjabSummary } from "./summary";
import { AnjabFamily } from "./family";
import { AnjabSources } from "./sources";
import { inputClass } from "./shared";

export function AnjabAbkAdmin({ initial, catalog }: { initial: AnjabPlanRecord; catalog: SourceCatalog }) {
  const router = useRouter(), [record, setRecord] = useState(initial), [plan, setPlan] = useState(initial.plan);
  const [tab, setTab] = useState("total"), [year, setYear] = useState(initial.year), [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const schema = useMemo(() => createAnjabPlanSchema(catalog), [catalog]);
  const validation = useMemo(() => schema.safeParse(plan), [schema, plan]);
  const result = useMemo(() => calculateAnjab(plan, catalog), [plan, catalog]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const leave = (event: MouseEvent) => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.href === window.location.href) return;
      if (!window.confirm("Perubahan Anjab-ABK belum disimpan. Tetap tinggalkan halaman ini?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", leave, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", leave, true); };
  }, [dirty]);
  function edit(recipe: (draft: AnjabPlan) => void) {
    setPlan(current => { const next = structuredClone(current); recipe(next); return next; });
    setDirty(true); setMessage(""); setError("");
  }
  async function save() {
    if (!validation.success || pending) return;
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/anjab-abk/${record.year}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: record.revision, plan }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Perhitungan gagal disimpan.");
      setRecord(data); setPlan(data.plan); setDirty(false); setMessage(data.message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Perhitungan gagal disimpan. Silakan coba lagi."); }
    finally { setPending(false); }
  }
  function changeYear(event: FormEvent) {
    event.preventDefault(); if (!validAnjabYear(year)) return;
    if (dirty && !window.confirm("Perubahan belum disimpan. Buka tahun lain tanpa menyimpan?")) return;
    setDirty(false); router.push(`/dashboard/anjab-abk?tahun=${year}`);
  }
  const family = catalog.families.find(item => item.id === tab), editor = { catalog, plan, result, edit };
  const tabs = [{ id: "total", label: "Total Semua Jabatan" }, ...catalog.families.map(item => ({ id: item.id, label: item.shortName })), { id: "sumber", label: "Analisis Sumber" }];
  function navigateTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); setTab(tabs[next].id); document.getElementById(`anjab-tab-${tabs[next].id}`)?.focus();
  }
  return <div className="mx-auto w-full min-w-0 max-w-[1500px] space-y-5 pb-24">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-emerald-700">Kepegawaian</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Anjab-ABK Jabatan Fungsional</h1><p className="mt-2 text-sm text-zinc-500">Perhitungan tahun {record.year} · 5 jabatan · 23 jenjang · 465 butir kegiatan</p></div><button type="button" onClick={save} disabled={pending || !validation.success || (!dirty && record.revision > 0)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{pending ? "Menyimpan…" : "Simpan perhitungan"}</button></header>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"><form onSubmit={changeYear} className="flex flex-wrap items-center gap-2"><label htmlFor="anjab-year" className="text-sm font-medium">Tahun perhitungan</label><input id="anjab-year" type="number" min={2000} max={2099} step={1} required value={Number.isFinite(year) ? year : ""} onChange={event => setYear(event.target.value === "" ? NaN : Number(event.target.value))} className={`${inputClass} !w-28`} /><button type="submit" disabled={pending} className="rounded-lg border px-3 py-2 text-sm hover:bg-zinc-50">Buka tahun</button></form><div className="text-xs text-zinc-500">{record.updatedAt ? `Tersimpan ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(record.updatedAt))}` : `Nilai awal dari lampiran ${catalog.baseYear}; belum disimpan untuk tahun ${record.year}.`}</div></div>
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!validation.success && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{validation.error.issues[0]?.code === "custom" ? validation.error.issues[0].message : "Lengkapi angka yang valid. Volume/AK tidak negatif, pembagi lebih besar dari nol, dan jumlah pegawai harus bilangan bulat."}</p>}
    <fieldset disabled={pending} className="min-w-0 space-y-5">
      <nav aria-label="Menu Anjab-ABK" className="overflow-x-auto rounded-xl border bg-white p-2"><div role="tablist" aria-label="Perhitungan Anjab-ABK" className="flex min-w-max gap-1">{tabs.map((item, index) => <button key={item.id} id={`anjab-tab-${item.id}`} type="button" role="tab" tabIndex={tab === item.id ? 0 : -1} onKeyDown={event => navigateTab(event, index)} aria-selected={tab === item.id} aria-controls="anjab-panel" onClick={() => setTab(item.id)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${tab === item.id ? "bg-emerald-700 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>{item.id === "total" ? <Calculator className="size-4" /> : item.id === "sumber" ? <FileSpreadsheet className="size-4" /> : null}{item.label}</button>)}</div></nav>
      <div id="anjab-panel" role="tabpanel" aria-labelledby={`anjab-tab-${tab}`}>
        {tab === "total" ? <AnjabSummary {...editor} openFamily={setTab} /> : family ? <AnjabFamily key={family.id} {...editor} family={family} /> : <AnjabSources catalog={catalog} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-white p-4"><p className="text-xs text-zinc-500">Perubahan disimpan per tahun. Input dan rumus awal dapat ditelusuri pada menu Analisis Sumber.</p><button type="button" onClick={() => { if (window.confirm("Pulihkan semua isian tahun ini ke nilai awal lampiran 2026? Perubahan baru berlaku setelah disimpan.")) { setPlan(defaultAnjabPlan(catalog)); setDirty(true); setError(""); setMessage(""); } }} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-zinc-50"><RotateCcw className="size-3.5" />Pulihkan isian lampiran</button></div>
    </fieldset>
    {dirty && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><span className="text-xs text-zinc-600">Perubahan belum disimpan</span><button type="button" onClick={save} disabled={pending || !validation.success} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{pending && <LoaderCircle className="size-4 animate-spin" />}{pending ? "Menyimpan…" : "Simpan perubahan"}</button></div>}
  </div>;
}
