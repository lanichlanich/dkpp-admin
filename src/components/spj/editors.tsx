"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import type { SpjType, SpjWorker } from "@/lib/spj-types";
import { spjActionClass, spjRequest, spjSelectClass } from "./shared";

export function SpjTypeEditor({ value, done }: { value?: SpjType; done: () => void }) {
  const [fields, setFields] = useState({ name: value?.name ?? "", dayMode: value?.dayMode ?? "quota", activeDays: value?.activeDays ?? 10, dailyRate: value?.dailyRate ?? 125000, weekdays: value?.weekdays ?? [1, 2, 3, 4, 5] });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await spjRequest(value ? `types/${value.id}` : "types", value ? "PATCH" : "POST", { ...fields, updatedAt: value?.updatedAt }); toast.success("Jenis tenaga disimpan."); done(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5"><fieldset disabled={busy} className="space-y-4">
    <div className="space-y-2"><Label htmlFor="type-name">Nama jenis tenaga</Label><Input id="type-name" required maxLength={120} value={fields.name} onChange={e => setFields(v => ({ ...v, name: e.target.value }))} placeholder="Contoh: Tenaga Kebersihan" /></div>
    <div className="space-y-2"><Label htmlFor="type-mode">Aturan hari aktif</Label><select id="type-mode" value={fields.dayMode} className={spjSelectClass} onChange={e => setFields(v => ({ ...v, dayMode: e.target.value as "quota" | "all" }))}><option value="quota">Jumlah hari tertentu per bulan</option><option value="all">Semua hari kerja yang memenuhi aturan</option></select></div>
    {fields.dayMode === "quota" && <div className="space-y-2"><Label htmlFor="type-days">Jumlah hari aktif per bulan</Label><Input id="type-days" type="number" min={1} max={31} step={1} required value={fields.activeDays} onChange={e => setFields(v => ({ ...v, activeDays: Number(e.target.value) }))} /></div>}
    <div className="space-y-2"><p className="text-sm font-medium">Hari yang dapat dipilih</p><div className="flex flex-wrap gap-3">{["Senin", "Selasa", "Rabu", "Kamis", "Jumat"].map((label, i) => <label key={label} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fields.weekdays.includes(i + 1)} onChange={e => setFields(v => ({ ...v, weekdays: e.target.checked ? [...v.weekdays, i + 1].sort() : v.weekdays.filter(d => d !== i + 1) }))} />{label}</label>)}</div><p className="text-xs text-zinc-500">Sabtu, Minggu, dan libur nasional selalu dikecualikan.</p></div>
    <div className="space-y-2"><Label htmlFor="type-rate">Honor per hari (Rp)</Label><Input id="type-rate" type="number" min={0} max={1000000000} step={1} required value={fields.dailyRate} onChange={e => setFields(v => ({ ...v, dailyRate: Number(e.target.value) }))} /></div>
  </fieldset>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={done}>Batal</Button><Button type="submit" className={spjActionClass.primary} disabled={busy}>{busy ? "Menyimpan…" : "Simpan jenis tenaga"}</Button></DialogFooter></form>;
}
export function SpjWorkerEditor({ value, types, done }: { value?: SpjWorker; types: SpjType[]; done: () => void }) {
  const [fields, setFields] = useState({ typeId: value?.typeId ?? types[0]?.id ?? "", name: value?.name ?? "", bank: value?.bank ?? "", accountNumber: value?.accountNumber ?? "", isActive: value?.isActive ?? true });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await spjRequest(value ? `workers/${value.id}` : "workers", value ? "PATCH" : "POST", { ...fields, updatedAt: value?.updatedAt }); toast.success("Petugas disimpan."); done(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5"><fieldset disabled={busy} className="space-y-4">
    <div className="space-y-2"><Label htmlFor="worker-type">Jenis tenaga petugas</Label><select id="worker-type" required className={spjSelectClass} value={fields.typeId} onChange={e => setFields(v => ({ ...v, typeId: e.target.value }))}>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
    <div className="space-y-2"><Label htmlFor="worker-name">Nama petugas</Label><Input id="worker-name" required maxLength={160} value={fields.name} onChange={e => setFields(v => ({ ...v, name: e.target.value }))} /></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="worker-bank">Bank</Label><Input id="worker-bank" maxLength={60} value={fields.bank} onChange={e => setFields(v => ({ ...v, bank: e.target.value }))} /></div><div className="space-y-2"><Label htmlFor="worker-account">Nomor rekening</Label><Input id="worker-account" inputMode="numeric" pattern="[0-9]*" maxLength={40} value={fields.accountNumber} onChange={e => setFields(v => ({ ...v, accountNumber: e.target.value }))} /></div></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fields.isActive} onChange={e => setFields(v => ({ ...v, isActive: e.target.checked }))} />Petugas aktif</label>
  </fieldset>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={done}>Batal</Button><Button type="submit" className={spjActionClass.primary} disabled={busy || !types.length}>{busy ? "Menyimpan…" : "Simpan petugas"}</Button></DialogFooter></form>;
}
